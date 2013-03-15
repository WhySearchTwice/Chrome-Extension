function Tree($scope, rexster) {
    $scope.pageViews = [];
    $scope.now = function() {
        return localStorage.targetTime || (new Date()).getTime();
    };
    $scope.range = localStorage.range || 30;            // range in minutes
    $scope.offset = localStorage.offset || 100;         // right offset in px
    $scope.lineHeight = localStorage.lineHeight || 20;  // history line height in px
    // set and execute tick
    $scope.tick = function() {
        rexster.search($scope.now(), {
            timeRange: $scope.range,
            timeRangeUnits: 'minutes'
        },function(response) {
            console.log(response);
            angular.extend($scope.pageViews, response);
        });
    };

    $scope.tick();
}