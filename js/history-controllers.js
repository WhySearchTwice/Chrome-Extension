function KineticCtrl($scope, rexster) {
    $scope.pageVisits = [];
    rexster.search((new Date()).getTime(), {
        timeRange: 30,
        timeRangeUnits: 'minutes'
    },function(response) {
        angular.extend($scope.pageVisits, response);
    });
}