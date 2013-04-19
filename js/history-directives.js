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
                    var roots = Object.keys($scope.tree.built.root).sort();
                    for (var i = 0, l = roots.length; i < l; i++) {
                        var group = $scope.createSubtree($scope.tree.built.root[roots[i]]);
                        group.setY(y);
                        layer.add(group);
                        y += group.getHeight() + $scope.lineHeight * 3; // 3: extra margin between windows
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
                    var group = new Kinetic.Group();
                    if (subtree.node) {
                        var start = $scope.pixelRatio * (subtree.node.pageOpenTime - $scope.leftTime);
                        var end = subtree.node.pageCloseTime ? $scope.pixelRatio * (subtree.node.pageCloseTime - $scope.leftTime): window.innerWidth - $scope.offset;
                        var nodegroup = $scope.createNode(start, end, subtree.node);
                        group.setHeight(group.getHeight() + nodegroup.getHeight());
                        group.add(nodegroup);
                    }
                    if (subtree.successor) {
                        group.add($scope.createSubtree(subtree.successor));
                    }
                    if (subtree.children || !subtree.node) {
                        var y = $scope.lineHeight;
                        var children = Object.keys(subtree.children || subtree).sort();
                        for (var i = 0, l = children.length; i < l; i++) {
                            var subgroup = $scope.createSubtree((subtree.children || subtree)[children[i]]);
                            subgroup.setY(subtree.children ? y : 0);
                            group.add(subgroup);
                            group.setHeight(group.getHeight() + subgroup.getHeight());
                            if (subtree.children) {
                                var path = new Kinetic.Line({
                                    opacity: 0.2,
                                    points: [subgroup.children[0].getX(), 17, subgroup.children[0].getX(), group.getHeight() - 3],
                                    stroke: 'black',
                                    strokeWidth: 1
                                });
                                group.add(path);
                            }
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
                 * @param  node           Information about page view
                 */
                $scope.createNode = function(start, end, node) {
                    var group = new Kinetic.Group({
                        x: start,
                        y: 0,
                        height: 20
                    });

                    var pageView = new Kinetic.Line({
                        points: [0, 15, end - start - 1, 15], // -1px for border between successors
                        stroke: !node.parentId && !node.predecessorId ? 'green': 'blue', // green == root
                        strokeWidth: 4
                    });
                    group.add(pageView);

                    if (!node.predecessorId ||
                        !$scope.tree.getPageView($scope.tree.vertexIds[node.predecessorId]) ||
                        $scope.tree.getPageView($scope.tree.vertexIds[node.predecessorId]).pageUrl !== node.pageUrl
                    ) {
                        var url = node.pageUrl || 'Missing URL';
                        // truncate URLs loner than 50 chars
                        if (url.length > 50) {
                            url = url.substr(0, 50) + '...';
                        }
                        var label = new Kinetic.Text({
                            text: url,
                            fontSize: 13,
                            fontFamily: 'Arial',
                            fill: end === window.innerWidth - $scope.offset ? '#000' : '#aaa', // black == still open
                            x: start < 0 ? -1 * start : 0 // prevent text from falling off left side of screen
                        });
                        group.add(label);
                    }

                    group.on('click', $scope.toggleHidden);
                    return group;
                };

                /**
                 * Toggles the hidden state of a group
                 * @author  ansel
                 *
                 * @param  {Object} event JS event
                 */
                $scope.toggleHidden = function(event) {
                    var parent = event.shape.parent;
                    while (parent.parent.parent.nodeType !== 'Stage') {
                        parent = parent.parent;
                    }
                    parent.setOpacity(parent.getOpacity() === 0.2 ? 1 : 0.2);
                    $scope.stage.draw();
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