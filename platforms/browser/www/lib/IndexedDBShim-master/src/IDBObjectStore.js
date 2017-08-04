import {createDOMException} from './DOMException.js';
import {IDBCursor, IDBCursorWithValue} from './IDBCursor.js';
import {setSQLForRange, IDBKeyRange} from './IDBKeyRange.js';
import * as util from './util.js';
import Key from './Key.js';
import {executeFetchIndexData, fetchIndexData, IDBIndex} from './IDBIndex.js';
import IDBTransaction from './IDBTransaction.js';
import Sca from './Sca.js';
import CFG from './CFG.js';
import SyncPromise from 'sync-promise';

/**
 * IndexedDB Object Store
 * http://dvcs.w3.org/hg/IndexedDB/raw-file/tip/Overview.html#idl-def-IDBObjectStore
 * @param {IDBObjectStoreProperties} storeProperties
 * @param {IDBTransaction} transaction
 * @constructor
 */
function IDBObjectStore (storeProperties, transaction) {
    this.__name = storeProperties.name;
    this.__keyPath = Array.isArray(storeProperties.keyPath) ? storeProperties.keyPath.slice() : storeProperties.keyPath;
    this.__transaction = transaction;
    this.__idbdb = storeProperties.idbdb;
    this.__cursors = storeProperties.cursors || [];

    // autoInc is numeric (0/1) on WinPhone
    this.__autoIncrement = !!storeProperties.autoInc;

    this.__indexes = {};
    this.__indexNames = new util.StringList();
    const indexList = storeProperties.indexList;
    for (const indexName in indexList) {
        if (indexList.hasOwnProperty(indexName)) {
            const index = new IDBIndex(this, indexList[indexName]);
            this.__indexes[index.name] = index;
            if (!index.__deleted) {
                this.indexNames.push(index.name);
            }
        }
    }
}

/**
 * Clones an IDBObjectStore instance for a different IDBTransaction instance.
 * @param {IDBObjectStore} store
 * @param {IDBTransaction} transaction
 * @protected
 */
IDBObjectStore.__clone = function (store, transaction) {
    const newStore = new IDBObjectStore({
        name: store.name,
        keyPath: Array.isArray(store.keyPath) ? store.keyPath.slice() : store.keyPath,
        autoInc: store.autoIncrement,
        indexList: {},
        idbdb: store.__idbdb,
        cursors: store.__cursors
    }, transaction);
    newStore.__indexes = store.__indexes;
    newStore.__indexNames = store.indexNames;
    return newStore;
};

/**
 * Creates a new object store in the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 */
IDBObjectStore.__createObjectStore = function (db, store) {
    // Add the object store to the IDBDatabase
    db.__objectStores[store.name] = store;
    db.objectStoreNames.push(store.name);

    // Add the object store to WebSQL
    const transaction = db.__versionTransaction;
    IDBTransaction.__assertVersionChange(transaction);
    transaction.__addNonRequestToTransactionQueue(function createObjectStore (tx, args, success, failure) {
        function error (tx, err) {
            CFG.DEBUG && console.log(err);
            throw createDOMException(0, 'Could not create object store "' + store.name + '"', err);
        }

        // key INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL UNIQUE
        const sql = ['CREATE TABLE', util.escapeStore(store.name), '(key BLOB', store.autoIncrement ? 'UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT' : 'PRIMARY KEY', ', value BLOB)'].join(' ');
        CFG.DEBUG && console.log(sql);
        tx.executeSql(sql, [], function (tx, data) {
            tx.executeSql('INSERT INTO __sys__ VALUES (?,?,?,?,?)', [store.name, JSON.stringify(store.keyPath), store.autoIncrement, '{}', 1], function () {
                success(store);
            }, error);
        }, error);
    });
};

/**
 * Deletes an object store from the database.
 * @param {IDBDatabase} db
 * @param {IDBObjectStore} store
 * @protected
 */
IDBObjectStore.__deleteObjectStore = function (db, store) {
    // Remove the object store from the IDBDatabase
    store.__deleted = true;
    db.__objectStores[store.name] = undefined;
    db.objectStoreNames.splice(db.objectStoreNames.indexOf(store.name), 1);

    // Remove the object store from WebSQL
    const transaction = db.__versionTransaction;
    IDBTransaction.__assertVersionChange(transaction);
    transaction.__addNonRequestToTransactionQueue(function deleteObjectStore (tx, args, success, failure) {
        function error (tx, err) {
            CFG.DEBUG && console.log(err);
            failure(createDOMException(0, 'Could not delete ObjectStore', err));
        }

        tx.executeSql('SELECT * FROM __sys__ WHERE name = ?', [store.name], function (tx, data) {
            if (data.rows.length > 0) {
                tx.executeSql('DROP TABLE ' + util.escapeStore(store.name), [], function () {
                    tx.executeSql('DELETE FROM __sys__ WHERE name = ?', [store.name], function () {
                        success();
                    }, error);
                }, error);
            }
        });
    });
};

/**
 * Determines whether the given inline or out-of-line key is valid, according to the object store's schema.
 * @param {*} value     Used for inline keys
 * @param {*} key       Used for out-of-line keys
 * @private
 */
IDBObjectStore.prototype.__validateKeyAndValue = function (value, key) {
    if (this.keyPath !== null) {
        if (key !== undefined) {
            throw createDOMException('DataError', 'The object store uses in-line keys and the key parameter was provided', this);
        }
        util.throwIfNotClonable(value, 'The data to be stored could not be cloned by the internal structured cloning algorithm.');
        key = Key.evaluateKeyPathOnValue(value, this.keyPath);
        if (key === undefined) {
            if (this.autoIncrement) {
                // Todo: Check whether this next check is a problem coming from `IDBCursor.update()`
                if (!util.isObj(value)) { // Although steps for storing will detect this, we want to throw synchronously for `add`/`put`
                    throw createDOMException('DataError', 'KeyPath was specified, but value was not an object');
                }
                // A key will be generated
                return undefined;
            }
            throw createDOMException('DataError', 'Could not evaluate a key from keyPath');
        }
        Key.convertValueToKey(key);
    } else {
        if (key === undefined) {
            if (this.autoIncrement) {
                // A key will be generated
                return undefined;
            }
            throw createDOMException('DataError', 'The object store uses out-of-line keys and has no key generator and the key parameter was not provided. ', this);
        }
        Key.convertValueToKey(key);
        util.throwIfNotClonable(value, 'The data to be stored could not be cloned by the internal structured cloning algorithm.');
    }

    return key;
};

/**
 * From the store properties and object, extracts the value for the key in the object store
 * If the table has auto increment, get the current number (unless it has a keyPath leading to a
 *  valid but non-numeric or < 1 key)
 * @param {Object} tx
 * @param {Object} value
 * @param {Object} key
 * @param {function} success
 * @param {function} failure
 */
IDBObjectStore.prototype.__deriveKey = function (tx, value, key, success, failure) {
    const me = this;

    function getCurrentNumber (callback) {
        tx.executeSql('SELECT currNum FROM __sys__ WHERE name = ?', [me.name], function (tx, data) {
            if (data.rows.length !== 1) {
                callback(1);
            } else {
                callback(data.rows.item(0).currNum);
            }
        }, function (tx, error) {
            failure(createDOMException('DataError', 'Could not get the auto increment value for key', error));
        });
    }

    // This variable determines against which key comparisons should be made
    //   when determining whether to update the current number
    let keyToCheck = key;
    const hasKeyPath = me.keyPath !== null;
    if (hasKeyPath) {
        keyToCheck = Key.evaluateKeyPathOnValue(value, me.keyPath);
    }
    // If auto-increment and no valid primaryKey found on the keyPath, get and set the new value, and use
    if (me.autoIncrement && keyToCheck === undefined) {
        getCurrentNumber(function (cn) {
            if (hasKeyPath) {
                try {
                    // Update the value with the new key
                    Key.setValue(value, me.keyPath, cn);
                } catch (e) {
                    failure(createDOMException('DataError', 'Could not assign a generated value to the keyPath', e));
                }
            }
            success(cn);
        });
    // If auto-increment and the keyPath item is a valid numeric key, get the old auto-increment to compare if the new is higher
    //  to determine which to use and whether to update the current number
    } else if (me.autoIncrement && Number.isFinite(keyToCheck) && keyToCheck >= 1) {
        getCurrentNumber(function (cn) {
            const useNewForAutoInc = keyToCheck >= cn;
            success(keyToCheck, useNewForAutoInc);
        });
    // Not auto-increment or auto-increment with a bad (non-numeric or < 1) keyPath key
    } else {
        success(keyToCheck);
    }
};

IDBObjectStore.prototype.__insertData = function (tx, encoded, value, primaryKey, passedKey, useNewForAutoInc, success, error) {
    const me = this;
    const paramMap = {};
    const indexPromises = me.indexNames.map((indexName) => {
        return new SyncPromise((resolve, reject) => {
            const index = me.__indexes[indexName];
            if (index.__pending) {
                resolve();
                return;
            }
            let indexKey;
            try {
                indexKey = Key.extractKeyFromValueUsingKeyPath(value, index.keyPath, index.multiEntry); // Add as necessary to this and skip past this index if exceptions here)
            } catch (err) {
                resolve();
                return;
            }
            function setIndexInfo (index) {
                if (indexKey === undefined) {
                    return;
                }
                paramMap[index.name] = Key.encode(indexKey, index.multiEntry);
            }
            if (index.unique) {
                const multiCheck = index.multiEntry && Array.isArray(indexKey);
                const fetchArgs = fetchIndexData(index, true, indexKey, 'key', multiCheck);
                executeFetchIndexData(...fetchArgs, tx, null, function success (key) {
                    if (key === undefined) {
                        setIndexInfo(index);
                        resolve();
                        return;
                    }
                    reject(createDOMException(
                        'ConstraintError',
                        'Index already contains a record equal to ' +
                            (multiCheck ? 'one of the subkeys of' : '') +
                            '`indexKey`'
                    ));
                }, reject);
            } else {
                setIndexInfo(index);
                resolve();
            }
        });
    });
    SyncPromise.all(indexPromises).then(() => {
        const sqlStart = ['INSERT INTO ', util.escapeStore(this.name), '('];
        const sqlEnd = [' VALUES ('];
        const insertSqlValues = [];
        if (primaryKey !== undefined) {
            Key.convertValueToKey(primaryKey);
            sqlStart.push(util.quote('key'), ',');
            sqlEnd.push('?,');
            insertSqlValues.push(Key.encode(primaryKey));
        }
        for (const key in paramMap) {
            sqlStart.push(util.escapeIndex(key) + ',');
            sqlEnd.push('?,');
            insertSqlValues.push(paramMap[key]);
        }
        // removing the trailing comma
        sqlStart.push(util.quote('value') + ' )');
        sqlEnd.push('?)');
        insertSqlValues.push(encoded);

        const insertSql = sqlStart.join(' ') + sqlEnd.join(' ');
        CFG.DEBUG && console.log('SQL for adding', insertSql, insertSqlValues);

        const insert = function (result) {
            let cb;
            if (typeof result === 'function') {
                cb = result;
                result = undefined;
            }
            tx.executeSql(insertSql, insertSqlValues, function (tx, data) {
                if (cb) {
                    cb();
                } else success(result);
            }, function (tx, err) {
                error(createDOMException('ConstraintError', err.message, err));
            });
        };

        // Need for a clone here?
        Sca.encode(primaryKey, function (primaryKey) {
            primaryKey = Sca.decode(primaryKey);
            if (!me.autoIncrement) {
                insert(primaryKey);
                return;
            }

            // Bump up the auto-inc counter if the key path-resolved value is valid (greater than old value and >=1) OR
            //  if a manually passed in key is valid (numeric and >= 1) and >= any primaryKey
            // Todo: If primaryKey is not a number, we should be checking the value of any previous "current number" and compare with that
            if (useNewForAutoInc) {
                insert(function () {
                    const sql = 'UPDATE __sys__ SET currNum = ? WHERE name = ?';
                    const sqlValues = [
                        Math.floor(primaryKey) + 1, me.name
                    ];
                    CFG.DEBUG && console.log(sql, sqlValues);
                    tx.executeSql(sql, sqlValues, function (tx, data) {
                        success(primaryKey);
                    }, function (tx, err) {
                        error(createDOMException('UnknownError', 'Could not set the auto increment value for key', err));
                    });
                });
            // If the key path-resolved value is invalid (not numeric or < 1) or
            //    if a manually passed in key is invalid (non-numeric or < 1),
            //    then we don't need to modify the current number
            } else if (useNewForAutoInc === false || !Number.isFinite(primaryKey) || primaryKey < 1) {
                insert(primaryKey);
            // Increment current number by 1 (we cannot leverage SQLite's
            //  autoincrement (and decrement when not needed), as decrementing
            //  will be overwritten/ignored upon the next insert)
            } else {
                insert(function () {
                    const sql = 'UPDATE __sys__ SET currNum = currNum + 1 WHERE name = ?';
                    const sqlValues = [me.name];
                    CFG.DEBUG && console.log(sql, sqlValues);
                    tx.executeSql(sql, sqlValues, function (tx, data) {
                        success(primaryKey);
                    }, function (tx, err) {
                        error(createDOMException('UnknownError', 'Could not set the auto increment value for key', err));
                    });
                });
            }
        });
    }).catch(function (err) {
        error(err);
    });
};

IDBObjectStore.prototype.add = function (value, key) {
    const me = this;
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    this.__validateKeyAndValue(value, key);

    const request = me.transaction.__createRequest(me);
    me.transaction.__pushToQueue(request, function objectStoreAdd (tx, args, success, error) {
        Sca.encode(value, function (encoded) {
            value = Sca.decode(encoded);
            me.__deriveKey(tx, value, key, function (primaryKey, useNewForAutoInc) {
                Sca.encode(value, function (encoded) {
                    me.__insertData(tx, encoded, value, primaryKey, key, useNewForAutoInc, function (...args) {
                        me.__cursors.forEach((cursor) => {
                            cursor.__addToCache(/* Key.encode(primaryKey), encoded */);
                        });
                        success(...args);
                    }, error);
                });
            }, error);
        });
    });
    return request;
};

IDBObjectStore.prototype.put = function (value, key) {
    const me = this;
    if (arguments.length === 0) {
        throw new TypeError('No value was specified');
    }
    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    me.transaction.__assertWritable();
    this.__validateKeyAndValue(value, key);

    const request = me.transaction.__createRequest(me);
    me.transaction.__pushToQueue(request, function objectStorePut (tx, args, success, error) {
        Sca.encode(value, function (encoded) {
            value = Sca.decode(encoded);
            me.__deriveKey(tx, value, key, function (primaryKey, useNewForAutoInc) {
                Sca.encode(value, function (encoded) {
                    // First try to delete if the record exists
                    Key.convertValueToKey(primaryKey);
                    const sql = 'DELETE FROM ' + util.escapeStore(me.name) + ' WHERE key = ?';
                    const encodedPrimaryKey = Key.encode(primaryKey);
                    tx.executeSql(sql, [encodedPrimaryKey], function (tx, data) {
                        CFG.DEBUG && console.log('Did the row with the', primaryKey, 'exist? ', data.rowsAffected);
                        me.__insertData(tx, encoded, value, primaryKey, key, useNewForAutoInc, function (...args) {
                            me.__cursors.forEach((cursor) => {
                                cursor.__addToCache(/* encodedPrimaryKey, encoded, !!data.rowsAffected */);
                            });
                            success(...args);
                        }, error);
                    }, function (tx, err) {
                        error(err);
                    });
                });
            }, error);
        });
    });
    return request;
};

IDBObjectStore.prototype.get = function (range) {
    const me = this;
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.get`.');
    }

    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    if (range == null) {
        throw createDOMException('DataError', 'No key or range was specified');
    }

    if (util.instanceOf(range, IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!range.toString() !== '[object IDBKeyRange]') {
            range = new IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
        }
    } else {
        range = IDBKeyRange.only(range);
    }

    let sql = ['SELECT * FROM ', util.escapeStore(me.name), ' WHERE '];
    const sqlValues = [];
    setSQLForRange(range, util.quote('key'), sql, sqlValues);
    sql = sql.join(' ');
    return me.transaction.__addToTransactionQueue(function objectStoreGet (tx, args, success, error) {
        CFG.DEBUG && console.log('Fetching', me.name, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            CFG.DEBUG && console.log('Fetched data', data);
            let value;
            try {
                // Opera can't deal with the try-catch here.
                if (data.rows.length === 0) {
                    return success();
                }

                value = Sca.decode(data.rows.item(0).value);
            } catch (e) {
                // If no result is returned, or error occurs when parsing JSON
                CFG.DEBUG && console.log(e);
            }
            success(value);
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

/*
// Todo: Implement getKey
IDBObjectStore.prototype.getKey = function (query) {
};
*/

/*
// Todo: Implement getAll
IDBObjectStore.prototype.getAll = function (query, count) {
};
*/

/*
// Todo: Implement getAllKeys
IDBObjectStore.prototype.getAllKeys = function (query, count) {
};
*/

IDBObjectStore.prototype['delete'] = function (range) {
    const me = this;
    if (!arguments.length) {
        throw new TypeError('A parameter was missing for `IDBObjectStore.delete`.');
    }

    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    me.transaction.__assertWritable();

    if (range == null) {
        throw createDOMException('DataError', 'No key or range was specified');
    }

    if (util.instanceOf(range, IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!range.toString() !== '[object IDBKeyRange]') {
            range = new IDBKeyRange(range.lower, range.upper, range.lowerOpen, range.upperOpen);
        }
    } else {
        range = IDBKeyRange.only(range);
    }

    const sqlArr = ['DELETE FROM ', util.escapeStore(me.name), ' WHERE '];
    const sqlValues = [];
    setSQLForRange(range, util.quote('key'), sqlArr, sqlValues);
    const sql = sqlArr.join(' ');

    return me.transaction.__addToTransactionQueue(function objectStoreDelete (tx, args, success, error) {
        CFG.DEBUG && console.log('Deleting', me.name, sqlValues);
        tx.executeSql(sql, sqlValues, function (tx, data) {
            CFG.DEBUG && console.log('Deleted from database', data.rowsAffected);
            me.__cursors.forEach((cursor) => {
                cursor.__deleteFromCache(/* sqlArr, sqlValues */);
            });
            success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

IDBObjectStore.prototype.clear = function () {
    const me = this;
    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    me.transaction.__assertWritable();

    return me.transaction.__addToTransactionQueue(function objectStoreClear (tx, args, success, error) {
        tx.executeSql('DELETE FROM ' + util.escapeStore(me.name), [], function (tx, data) {
            CFG.DEBUG && console.log('Cleared all records from database', data.rowsAffected);
            me.__cursors.forEach((cursor) => {
                cursor.__clearFromCache();
            });
            success();
        }, function (tx, err) {
            error(err);
        });
    }, undefined, me);
};

IDBObjectStore.prototype.count = function (key) {
    const me = this;
    if (me.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(me.transaction);
    if (util.instanceOf(key, IDBKeyRange)) {
        // We still need to validate IDBKeyRange-like objects (the above check is based on duck-typing)
        if (!key.toString() !== '[object IDBKeyRange]') {
            key = new IDBKeyRange(key.lower, key.upper, key.lowerOpen, key.upperOpen);
        }
        // We don't need to add to cursors array since has the count parameter which won't cache
        return new IDBCursorWithValue(key, 'next', this, this, 'key', 'value', true).__req;
    } else {
        const hasKey = key != null;

        // key is optional
        if (hasKey) {
            Key.convertValueToKey(key);
        }

        return me.transaction.__addToTransactionQueue(function objectStoreCount (tx, args, success, error) {
            const sql = 'SELECT * FROM ' + util.escapeStore(me.name) + (hasKey ? ' WHERE key = ?' : '');
            const sqlValues = [];
            hasKey && sqlValues.push(Key.encode(key));
            tx.executeSql(sql, sqlValues, function (tx, data) {
                success(data.rows.length);
            }, function (tx, err) {
                error(err);
            });
        }, undefined, me);
    }
};

IDBObjectStore.prototype.openCursor = function (range, direction) {
    if (this.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    const cursor = new IDBCursorWithValue(range, direction, this, this, 'key', 'value');
    this.__cursors.push(cursor);
    return cursor.__req;
};

IDBObjectStore.prototype.openKeyCursor = function (range, direction) {
    if (this.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    const cursor = new IDBCursor(range, direction, this, this, 'key', 'key');
    this.__cursors.push(cursor);
    return cursor.__req;
};

IDBObjectStore.prototype.index = function (indexName) {
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    if (this.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(this.transaction);
    const index = this.__indexes[indexName];
    if (!index || index.__deleted) {
        throw createDOMException('NotFoundError', 'Index "' + indexName + '" does not exist on ' + this.name);
    }

    return IDBIndex.__clone(index, this);
};

/**
 * Creates a new index on the object store.
 * @param {string} indexName
 * @param {string} keyPath
 * @param {object} optionalParameters
 * @returns {IDBIndex}
 */
IDBObjectStore.prototype.createIndex = function (indexName, keyPath, optionalParameters) {
    indexName = String(indexName); // W3C test within IDBObjectStore.js seems to accept string conversion
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    if (arguments.length === 1) {
        throw new TypeError('No key path was specified');
    }
    IDBTransaction.__assertVersionChange(this.transaction);
    if (this.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(this.transaction);
    if (this.__indexes[indexName] && !this.__indexes[indexName].__deleted) {
        throw createDOMException('ConstraintError', 'Index "' + indexName + '" already exists on ' + this.name);
    }
    if (!util.isValidKeyPath(keyPath)) {
        throw createDOMException('SyntaxError', 'A valid keyPath must be supplied');
    }
    if (Array.isArray(keyPath) && optionalParameters && optionalParameters.multiEntry) {
        throw createDOMException('InvalidAccessError', 'The keyPath argument was an array and the multiEntry option is true.');
    }

    optionalParameters = optionalParameters || {};
    /** @name IDBIndexProperties **/
    const indexProperties = {
        columnName: indexName,
        keyPath: keyPath,
        optionalParams: {
            unique: !!optionalParameters.unique,
            multiEntry: !!optionalParameters.multiEntry
        }
    };
    const index = new IDBIndex(this, indexProperties);
    IDBIndex.__createIndex(this, index);
    return index;
};

IDBObjectStore.prototype.deleteIndex = function (indexName) {
    if (arguments.length === 0) {
        throw new TypeError('No index name was specified');
    }
    IDBTransaction.__assertVersionChange(this.transaction);
    if (this.__deleted) {
        throw createDOMException('InvalidStateError', 'This store has been deleted');
    }
    IDBTransaction.__assertActive(this.transaction);
    const index = this.__indexes[indexName];
    if (!index) {
        throw createDOMException('NotFoundError', 'Index "' + indexName + '" does not exist on ' + this.name);
    }

    IDBIndex.__deleteIndex(this, index);
};

IDBObjectStore.prototype.toString = function () {
    return '[object IDBObjectStore]';
};

util.defineReadonlyProperties(IDBObjectStore.prototype, ['keyPath', 'indexNames', 'transaction', 'autoIncrement']);

Object.defineProperty(IDBObjectStore.prototype, 'name', {
    enumerable: false,
    configurable: false,
    get: function () {
        return this.__name;
    },
    set: function (name) {
        const me = this;
        if (this.__deleted) {
            throw createDOMException('InvalidStateError', 'This store has been deleted');
        }
        IDBTransaction.__assertVersionChange(this.transaction);
        IDBTransaction.__assertActive(this.transaction);
        if (me.name === name) {
            return;
        }
        if (me.__idbdb.__objectStores[name]) {
            throw createDOMException('ConstraintError', 'Object store "' + name + '" already exists in ' + me.__idbdb.name);
        }
        me.__name = name;
        // Todo: Add pending flag to delay queries against this store until renamed in SQLite

        const sql = 'ALTER TABLE ' + util.escapeStore(this.name) + ' RENAME TO ' + util.escapeStore(name);
        me.transaction.__addNonRequestToTransactionQueue(function objectStoreClear (tx, args, success, error) {
            tx.executeSql(sql, [], function (tx, data) {
                success();
            }, function (tx, err) {
                error(err);
            });
        });
    }
});

export default IDBObjectStore;
