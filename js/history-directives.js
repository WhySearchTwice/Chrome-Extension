angular.module('history.directives', [])
    .directive('kinetic', function($timeout) {
        return {
            restrict: 'E',
            replace: true,
            template: '<div id="container"></div>',
            link:function postLink(scope, iElement, iAttrs) {
                scope.stage = new Kinetic.Stage({
                    container: 'container',
                    width: window.innerWidth,
                    height: window.innerHeight - $('.navbar').outerHeight()
                });

                scope.drawAll = function() {
                    for (var i = 0; i < scope.pageVisits.length; i++) {
                        scope.drawNode(i*100, i*100, scope.pageVisits[i].pageUrl);
                    }
                };

                scope.$watch('pageVisits', function(newval, oldval){
                    scope.drawAll();
                }, true);

                scope.drawNode = function(posx, posy, urlval) {
                    var layer = new Kinetic.Layer();
                    var group = new Kinetic.Group({
                        x: posx,
                        y: posy
                    });

                    var url = (urlval === undefined) ? "Missing URL" : urlval;

                    var line = new Kinetic.Line({
                        points: [0, 25, 500, 25],
                        stroke: 'black',
                        strokeWidth: 4
                    });

                    var text = new Kinetic.Text({
                        text: url,
                        fontSize: 18,
                        fontFamily: 'FontAwesome',
                        fill: '#555',
                        width: 800
                    });

                    group.add(line);
                    group.add(text);
                    layer.add(group);
                    scope.stage.add(layer);
                };

                scope.drawAll();
            },
            controller: KineticCtrl
        };
    });