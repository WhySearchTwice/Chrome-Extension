function KineticCtrl($scope, rexster) {
    $scope.pageVisits = [];
    rexster.search((new Date()).getTime(), function(response) {
        angular.extend($scope.pageVisits, response);
    });
}