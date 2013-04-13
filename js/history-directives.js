/* JSHint: */
/* global Tree */

angular.module('history.directives', [])
    .directive('kinetic', function($timeout, $window) {
        return {
            restrict: 'E',
            replace: true,
            template: '<div id="container"></div>',
            link:function postLink($scope, iElement, iAttrs) {
                // create stage
                $scope.stage = new Kinetic.Stage({
                    container: 'container',
                    width: window.innerWidth,
                    height: window.innerHeight - $('.navbar').outerHeight()
                });

                $scope.$watch('tree.built', function() {
                    var ratio = (window.innerWidth - $scope.offset) / (1000 * 60 * $scope.range);   // ratio = effective canvas / range in ms
                    var leftTime = (new Date()).getTime() - (1000 * 60 * $scope.range);             // leftTime = now - range in ms
                    $scope.drawAll($scope.tree.built.root, ratio, leftTime);
                    $scope.stage.setSize({
                        width: $scope.viewportWidth,
                        height: $scope.lineHeight * 35
                    });
                }, true);

                $scope.viewportWidth = $window.innerWidth;
                angular.element($window).bind('resize', function() {
                    $scope.$apply(function() {
                        $scope.viewportWidth = $window.innerWidth;
                        $scope.viewportHeight = $window.innerHeight;
                    });
                });

                $scope.$watch('viewportWidth', function(newValue, oldValue) {
                    $scope.stage.setSize({
                        width: newValue
                    });
                });

                /**
                 * Draw all nodes in $scope.tree.built
                 * @author chris, ansel
                 */
                $scope.drawAll = function(built, ratio, leftTime) {
                    console.log("Logging built tree to be drawn");
                    console.log(built);
                    for (var nodeGroup in built) {
                        var start = ratio * (nodeGroup.node.pageOpenTime - leftTime);
                        var end = nodeGroup.node.pageCloseTime ? ratio * (nodeGroup.node.pageCloseTime - leftTime) : window.innerWidth - $scope.offset;
                        var group = new Kinetic.Group({
                            x: start,
                            y: $scope.lineHeight
                        });
                        $scope.drawNode(start, end, group, nodeGroup.node);
                        if (nodeGroup.successor) {
                            $scope.drawAll(nodeGroup.successor, ratio, leftTime);
                        }
                        if (nodeGroup.children) {
                            for (var childGroup in nodeGroup.children) {
                                $scope.drawAll(childGroup, ratio, leftTime);
                            }
                        }
                    }
                };

                /**
                 * Draw a single node
                 * @author chris
                 *
                 * @param  {Int} start    pageOpenTime on x axis
                 * @param  {Int} end      pageCloseTime on x axis
                 * @param  group          group for node
                 * @param  node           Information about page view
                 */
                $scope.drawNode = function(start, end, group, node) {
                    var layer = new Kinetic.Layer();

                    var line = new Kinetic.Line({
                        points: [0, 15, end - start, 15],
                        stroke: end === window.innerWidth - $scope.offset ? 'blue' : 'black', // blue == still open
                        strokeWidth: 4
                    });

                    var url = node.pageUrl || 'Missing URL';
                    // truncate URLs loner than 50 chars
                    if (url.length > 50) {
                        url = url.substr(0, 50) + '...';
                    }

                    var text = new Kinetic.Text({
                        text: url,
                        fontSize: 13,
                        fontFamily: 'Arial',
                        fill: '#aaa',
                        width: 800,
                        x: start < 0 ? -1 * start : 0 // prevent text from falling off left side of screen
                    });

                    group.add(line);
                    group.add(text);
                    layer.add(group);
                    $scope.stage.add(layer);
                };

                // draw now line
                var layer = new Kinetic.Layer();
                var line = new Kinetic.Line({
                    points: [window.innerWidth - $scope.offset, 0, window.innerWidth - $scope.offset, 10000],
                    stroke: 'red',
                    strokeWidth: 2
                });
                layer.add(line);
                $scope.stage.add(layer);
                $scope.drawAll();
            },
            controller: Tree
        };
    })

;