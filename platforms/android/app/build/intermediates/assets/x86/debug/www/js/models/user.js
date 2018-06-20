(function (window, app) {
	'use strict';
	app.service('User', function (MemberSqlService, $q) {
		var User = Class.create({
			initialize: function (name) {
				this.name = name;
				this.can = 0;
				this.company = '';
				this.accountInfo = new AccountInfo();
			},
			isFromUrl: function (strUrl) {
				return this.accountInfo && this.accountInfo.url === strUrl;
			},
			getId: function () {
				return this.accountInfo.accountId;
			},
			getName: function () {
				return this.name;
			},
			getCompany: function () {
				return this.company;
			},
			getPlace: function () {
				return this.accountInfo.accountId;
			},
			getBalance: function () {
				return this.accountInfo.securityCode;
			},
			getRewards: function () {
				return this.can;
			},
			getLastTx: function () {
				return -1;
			},
			getBlobImage: function () {
				return this.photo;
			},
			saveInSQLite: function () {
				if (this.unregistered) {
					var p = $q.defer();
					p.resolve();
					return p.promise;
				}
				return MemberSqlService.saveMember(this);
			},
			isDemo: function () {
				return this.accountInfo.isDemo();
			},
			getCan: function () {
				return this.can;
			},
			default: ''
		});
		window.User = User;
		return User;
	});
})(window, app);
