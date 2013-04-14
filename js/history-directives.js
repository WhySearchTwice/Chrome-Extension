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
                    var layer = new Kinetic.Layer();
                    var y = $scope.lineHeight;
                    for (var subtree in $scope.tree.built.root) {
                        var group = $scope.createSubtree($scope.tree.built.root[subtree]);
                        group.setY(y);
                        layer.add(group);
                        y += $scope.lineHeight;
                    }
                    console.log(layer);
                    $scope.stage.setSize({
                        width: $scope.viewportWidth,
                        height: $scope.lineHeight * 35
                    });
                    $scope.stage.add(layer);
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
                 * @param  {Object}       subtree subtree to be subtree
                 * @return {KineticGroup}         Kinetic group of groups to draw
                 */
                $scope.createSubtree = function(subtree) {
                    console.log('Drawing:');
                    console.log(subtree);
                    var group = new Kinetic.Group();
                    if (subtree.node) {
                        var start = $scope.pixelRatio * (subtree.node.pageOpenTime - $scope.leftTime);
                        var end = subtree.node.pageCloseTime ? start : window.innerWidth - $scope.offset;
                        group.add($scope.createNode(start, end, subtree.node));
                    }
                    if (subtree.successor) {
                        group.add($scope.createSubtree(subtree.successor));
                    }
                    if (subtree.children) {
                        var y = $scope.lineHeight * 2;
                        for (var child in subtree.children) {
                            var subgroup = $scope.createSubtree(subtree.children[child]);
                            subgroup.setY(y);
                            group.add(subgroup);
                            y += $scope.lineHeight;
                        }
                    }
                    return group;
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
                $scope.createNode = function(start, end, node) {
                    var group = new Kinetic.Group({
                        x: start,
                        y: $scope.lineHeight
                    });
                    var y = $scope.lineHeight;

                    var line = new Kinetic.Line({
                        points: [0, y + 15, end - start, y + 15],
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
                    return group;
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