function KineticCtrl($scope, rexster) {
    $scope.pageVisits = [];
    rexster.search((new Date()).getTime() - 3600000, function(response) {
        angular.extend($scope.pageVisits, response);
    });
}