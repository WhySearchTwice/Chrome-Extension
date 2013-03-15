var NOW = (new Date()).getTime();
var RANGE = 30;

function KineticCtrl($scope, rexster) {
    $scope.pageVisits = [];
    rexster.search(NOW, {
        timeRange: RANGE,
        timeRangeUnits: 'minutes'
    },function(response) {
        console.log(response);
        angular.extend($scope.pageVisits, response);
    });
}