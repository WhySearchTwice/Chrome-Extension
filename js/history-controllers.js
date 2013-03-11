function KineticCtrl($scope) {
    $scope.stage = new Kinetic.Stage({
        container: 'container',
        width: window.innerWidth,
        height: window.innerHeight - $('.navbar').outerHeight()
    });

    $scope.drawNode = function(posx, posy) {
        var layer = new Kinetic.Layer();
        var group = new Kinetic.Group({
            x: posx,
            y: posy
        });

        var line = new Kinetic.Line({
            points: [0, 25, 500, 25],
            stroke: 'black',
            strokeWidth: 4
        });

        var text = new Kinetic.Text({
            text: 'www.google.com',
            fontSize: 18,
            fontFamily: 'FontAwesome',
            fill: '#555',
            width: 300
        });

        group.add(line);
        group.add(text);
        layer.add(group);
        $scope.stage.add(layer);
    };

    $scope.

    $scope.drawNode(200, 400);
    $scope.drawNode(800, 300);
    $scope.drawNode(400, 100);
}