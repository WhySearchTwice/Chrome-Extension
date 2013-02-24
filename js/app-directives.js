angular.module('history.directives', [])
    .directive('appVersion', ['version', function(version) {
        return function(scope, elm, attrs) {
            elm.text(version);
        };
    }])
    .directive('kinetic', function() {
        var kineticContainer = '<div ng-dblclick="drawShapes()" id="container"></div>';
        return {
            restrict: 'E',
            compile:function (tElement, tAttrs, transclude) {
                tElement.html(kineticContainer);

                return function (scope, element, attrs) {
                    scope.stage = new Kinetic.Stage({
                        container: 'container',
                        width: 578,
                        height: 363
                    });

                    scope.drawShapes = function() {
                        var layer = new Kinetic.Layer();

                        var colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
                        for(var n = 0; n < 10; n++) {
                            var shape = new Kinetic.RegularPolygon({
                                x: Math.random() * scope.stage.getWidth(),
                                y: Math.random() * scope.stage.getHeight(),
                                sides: Math.ceil(Math.random() * 5 + 3),
                                radius: Math.random() * 100 + 20,
                                fill: colors[Math.round(Math.random() * 5)],
                                stroke: 'black',
                                alpha: Math.random(),
                                strokeWidth: 4,
                                draggable: true
                            });
                            layer.add(shape);
                        }

                        scope.stage.add(layer);
                    };
                };
            }
        };
    })
;
