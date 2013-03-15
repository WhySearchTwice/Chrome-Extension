function KineticCtrl($scope, rexster) {
    $scope.nodes = 4;
    rexster.search((new Date()).getTime(), function(response) {
        console.log(response);
    });
}