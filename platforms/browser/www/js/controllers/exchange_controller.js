/* global app */
(function () {
	'use strict';
	app.controller('ExchangeCtrl', function ($scope, ExchangeService, $translate, TransactionService, $ionicLoading, $state) {
		var self = this;
		$scope.amount = 0;
		this.init = function () {
			this.exchange = ExchangeService.getExchange();
			this.paymentMethod = this.exchange.getPaymentMethod();
			self.CommonGoodIsCurrencyFrom = self.exchange.getCurrencyFrom().getType() === 'rcredit';
			$translate('exchange_includes_fee', {
				feeValue: this.paymentMethod.getFee().getTitle(),
				paymentName: this.paymentMethod.getName()
			}).then(function (msg) {
				self.paymentFeeTitle = msg;
			});
		};
		this.calculateOutAmount = function () {
			return this.paymentMethod.applyFeeTo($scope.amount);
		};
		this.doExchange = function () {
			$ionicLoading.show();
			console.log($scope.amount, this.exchange.getCurrencyFrom(), this);
			TransactionService.exchange($scope.amount, this.exchange.getCurrencyFrom(), this.paymentMethod)
				.then(function (transaction) {
					console.log(transaction,$scope.amount, this);
					$state.go('app.transaction_result',
						{'transactionStatus': 'success', 'transactionAmount': transaction.amount});
				})
				.finally(function () {
					$ionicLoading.hide();
				});
		};
		this.init();
	});
})(app);