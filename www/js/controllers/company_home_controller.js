/* global app, ionic */
app.controller('CompanyHomeCtrl', function ($scope, $state, $ionicLoading, BarcodeService, UserService, $ionicHistory, NotificationService, $rootScope, CashierModeService, SelfServiceMode, $translate, $ionicPlatform, $location) {
	var onSellerLoginEvent = $rootScope.$on('sellerLogin', function () {
		$scope.currentUser = UserService.currentUser();
	});
	$scope.currentUser = UserService.currentUser();
	console.log(UserService.currentUser());
	if (!$scope.currentUser) {
		$state.go("app.login");
	}
	if ($scope.currentUser && $scope.currentUser.isFirstLogin()) {
		$scope.currentUser.setFirstLoginNotified();
	}
	$scope.isCashierMode = function () {
		return CashierModeService.isEnabled();
	};
	$scope.isSelfServiceEnabled = function () {
		return SelfServiceMode.isActive();
	};
	$scope.testPopup = function () {
		NotificationService.showAlert({title: "Error", template: "test"});
	};
	$scope.scanCustomer = function () {
		if ($scope.isSelfServiceEnabled()) {
			$state.go('app.self_service_mode');
			return;
		}
		$ionicLoading.show();
		$ionicPlatform.ready(function () {
			var platform = ionic.Platform.platform();
			if (platform === 'win64' || platform === 'win32' || platform === 'macintel') {
				$rootScope.whereWasI = location.hash;
				$state.go("app.demo");
				$ionicLoading.hide();
			} else {
				BarcodeService.scan('app.home')
					.then(function (id) {
						UserService.identifyCustomer(id)
							.then(function () {
								console.log(id);
								$scope.customer = UserService.currentCustomer();
								if ($scope.customer.firstPurchase) {
									NotificationService.showConfirm({
										title: 'firstPurchase',
										templateUrl: "templates/first-purchase.html",
										scope: $scope,
										okText: "confirm"
									})
										.then(function (confirmed) {
											if (confirmed) {
												$ionicLoading.show();
												$state.go("app.customer");
											}
										});
									$ionicLoading.hide();
								} else {
									$ionicLoading.hide();
									$state.go("app.customer");
								}
							})
							.catch(function (errorMsg) {
								console.log($scope.currentUser.name);
//						for (var prop in $scope.currentUser) {
//						}
								if (errorMsg === 'login_your_self') {
									NotificationService.showAlert({title: "Error", template: "You are already signed in as: " + $scope.currentUser.name});
								} else {
									NotificationService.showAlert({title: "Error", template: errorMsg});
								}
								$ionicLoading.hide();
							});
					})
					.catch(function (errorMsg) {
						NotificationService.showAlert({title: "error", template: errorMsg});
						$ionicLoading.hide();
					});
				$scope.$on('$destroy', function () {
					if (onSellerLoginEvent) {
						onSellerLoginEvent();
					}
				});
			}
			;
		});
	};
});
