/* global _, app */
(function (window, app) {
	app.service('Seller', function (localStorageService, User, PreferenceService) {
		var DEVICE_ID_KEY = 'deviceID';
		var SELLER_KEY = 'seller';
		var Seller = Class.create(User, {
			balance: 0,
			descriptions: [],
			device: '',
			firstLogin: false,
			initialize: function ($super, name) {
				$super(name);
				this.configureDeviceId_();
			},
			isValidDeviceId: function (device) {
				return !_.isEmpty(device);
			},
			setBalance:function (b){
				console.log(b);
				this.balance=b;
			},
			getBalance:function (){
				return this.balance;
			},
			configureDeviceId_: function () {
				this.device = '';
				var localDeviceId = localStorageService.get(DEVICE_ID_KEY);
				if (this.isValidDeviceId(localDeviceId)) {
					this.device = localDeviceId;
				}
			},
			setDeviceId: function (device) {
				if (!this.isValidDeviceId(device)) {
					throw new Error('Invalid deviceID: ' + device);
				}
				this.device = device;
				localStorageService.set(DEVICE_ID_KEY, device);
			},
			hasDevice: function () {
				return !_.isEmpty(this.device);
			},
			removeDevice: function () {
				this.device = '';
				localStorageService.remove(DEVICE_ID_KEY);
			},
			isFirstLogin: function () {
				return this.firstLogin;
			},
			setFirstLoginNotified: function () {
				this.firstLogin = false;
				this.save();
			},
			save: function () {
				this.saveInStorage();
				this.saveInSQLite();
			},
			saveInStorage: function () {
				console.log(this);
				localStorageService.set(SELLER_KEY, JSON.stringify(this));
			},
			fillFromStorage: function () {
				var sellerData = localStorageService.get(SELLER_KEY);
				if (sellerData) {
					_.extendOwn(this, JSON.parse(sellerData));
					this.accountInfo = _.extendOwn(new AccountInfo(), this.accountInfo);
					this.configureDeviceId_();
					PreferenceService.parsePreferencesNumber(this.getCan());
					console.log(this);
					return this;
				}
				throw new Error("Unable to load user from Storage");
			},
			removeFromStorage: function () {
				localStorageService.remove(SELLER_KEY); 
			}
		});
		window.Seller = Seller;
		return Seller;
	});
})(window, app);