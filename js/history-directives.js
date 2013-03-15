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
                    console.log(scope.pageVisits);
                    for (var i = 0; i < scope.pageVisits.length; i++) {
                        var ratio = window.innerWidth/3600000;
                        var x1 = ratio * ((new Date()).getTime() - scope.pageVisits[i].pageOpenTime);
                        window.console.log(x1);
                        var x2 = (scope.pageVisits[i].pageCloseTime === undefined) ? window.innerWidth : (new Date()).getTime() - scope.pageVisits[i].pageCloseTime;
                        scope.drawNode(x1, x2, i*10, scope.pageVisits[i]);
                    }
                };

                scope.$watch('pageVisits', function(newval, oldval){
                    scope.drawAll();
                }, true);

                scope.drawNode = function(posx1, posx2, posy, pagevisit) {
                    var layer = new Kinetic.Layer();
                    var group = new Kinetic.Group({
                        x: posx1,
                        y: posy
                    });

                    var url = pagevisit.pageUrl || "Missing URL";

                    var line = new Kinetic.Line({
                        points: [0, 25, posx2 - posx1, 25],
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