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
                    $scope.pixelRatio = (window.innerWidth - $scope.offset) / (1000 * 60 * $scope.range);   // pixelRatio = effective canvas / range in ms
                    $scope.leftTime = (new Date()).getTime() - (1000 * 60 * $scope.range);                  // leftTime = now - range in ms
                    for (var subtree in $scope.tree.built.root) {
                        $scope.drawSubtree($scope.tree.built.root[subtree]);
                    }
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
                 * Recursively draw all nodes in a subtree tree
                 * @author chris, ansel
                 *
                 * @param {Object} subtree subtree to be subtree
                 */
                $scope.drawSubtree = function(subtree) {
                    console.log('Drawing:');
                    console.log(subtree);
                    if (subtree.node) {
                        var start = $scope.pixelRatio * (subtree.node.pageOpenTime - $scope.leftTime);
                        var end = subtree.node.pageCloseTime ? start : window.innerWidth - $scope.offset;
                        var group = new Kinetic.Group({
                            x: start,
                            y: $scope.lineHeight
                        });
                        $scope.drawNode(start, end, group, subtree.node);
                    }
                    if (subtree.successor) {
                        $scope.drawSubtree(subtree.successor);
                    }
                    if (subtree.children) {
                        for (var child in subtree.children) {
                            $scope.drawSubtree(subtree.children[child]);
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
            },
            controller: Tree
        };
    })

;