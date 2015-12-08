app.controller('UserSessionCtrl', function($scope, $state, $ionicLoading, $ionicPopup, BarcodeService, UserService) {
  var loggedIn = false;

  var messages = {
    "loginSuccess": "You successfully logged in.",
    "loginFailure": "You were not logged in.",
    "logoutSuccess": "You were successfully logged out.",
    "logoutFailure": "Logout was unsuccessful. Please try again."
  }

  $scope.openScanner = function(){
    $ionicLoading.show();

    BarcodeService.scan()
    .then(function(str){
      UserService.loginWithRCard(str)
      .then(function(){
        $scope.redirectHome();
      })
      .catch(function(errorMsg){
        $scope.showAlert(errorMsg);
      });
    })
    .catch(function(errorMsg){
      $scope.showAlert(errorMsg);
    })
    .finally(function(){
      $ionicLoading.hide();
    });
  };

  // Logout

  $scope.logout = function(){
    $ionicLoading.show();

    setTimeout(function(){

      // Set to true or false to simulate logout success/failure
      loggedIn = false;

      if (loggedIn){
        $scope.logoutError();
      } else {
        $scope.logoutSuccess();
      }

    }, 1000);
  };

  $scope.logoutSuccess = function(){
    $scope.redirectToLogin();
    $ionicLoading.hide();
  };

  $scope.logoutError = function(){
    $scope.showAlert(messages.logoutFailure);
  }

  // Redirects

  $scope.redirectHome = function(){
    $state.go("app.home");
  };

  $scope.redirectToLogin = function(){
    $state.go("app.rlogin");
  };

  // Alert

  $scope.showAlert = function(message) {
    $ionicLoading.hide();
    $ionicPopup.alert({
      template: message
    });
  };
});
