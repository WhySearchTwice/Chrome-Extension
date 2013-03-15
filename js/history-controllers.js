function Tree($scope, rexster) {
    $scope.pageViews = [];
    $scope.now = function() {
        return (new Date()).getTime();
    };
    $scope.range = 60;      // range in minutes
    $scope.offset = 100;    // right offset in px
    $scope.lineHeight = 20; // history line height in px
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