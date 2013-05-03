/* JSHint: */
/* global Tree, moment */

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
                $scope.layers = {};
                $scope.layers.popups = new Kinetic.Layer();
                $scope.stage.add($scope.layers.popups);

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
                 * Draws the entire tree
                 * @author ansel
                 */
                $scope.drawTree = function() {
                    $scope.pixelRatio = (window.innerWidth - $scope.offset) / (1000 * 60 * $scope.range);   // pixelRatio = effective canvas / range in ms
                    $scope.leftTime = $scope.right - (1000 * 60 * $scope.range);                            // leftTime = now - range in ms
                    if ($scope.layers.tree) {
                        $scope.layers.tree.removeChildren();
                        $scope.layers.scale.removeChildren();
                    } else {
                        $scope.layers.tree = new Kinetic.Layer();
                        $scope.layers.scale = new Kinetic.Layer();
                    }

                    // draw scale
                    $scope.layers.scale.add(new Kinetic.Text({
                        text: moment($scope.leftTime).format('MMM D H:mma'),
                        fontSize: 13,
                        fontFamily: '"Ubuntu Mono"',
                        fill: '#000',
                        x: 5,
                        y: 5
                    }));
                    $scope.layers.scale.add(new Kinetic.Text({
                        text: moment($scope.right).format('MMM D H:mma'),
                        fontSize: 13,
                        fontFamily: '"Ubuntu Mono"',
                        fill: '#000',
                        x: window.innerWidth - $scope.offset - 100,
                        y: 5
                    }));
                    $scope.stage.add($scope.layers.scale);

                    // draw tree
                    var y = $scope.lineHeight;
                    var roots = Object.keys($scope.tree.built.root).sort();
                    for (var i = 0, l = roots.length; i < l; i++) {
                        var group = $scope.createSubtree($scope.tree.built.root[roots[i]], 0);
                        group.setY(y);
                        $scope.layers.tree.add(group);
                        y += group.getHeight() + $scope.lineHeight * 3; // 3: extra margin between windows
                    }
                    console.log($scope.layers.tree);
                    $scope.stage.setSize({
                        width: $scope.viewportWidth,
                        height: y
                    });
                    $scope.stage.add($scope.layers.tree);
                    if ($scope.right - $scope.now() > 60000) {
                        $scope.layers.now.hide();
                    } else {
                        $scope.layers.now.show();
                    }
                };

                $scope.$watch('tree.built', $scope.drawTree, true);
                $scope.$watch('[range, right]', function() {
                    $scope.drawTree();
                    $scope.updateData();
                }, true);

                /**
                 * Recursively draw all nodes in a subtree tree
                 * @author chris, ansel
                 *
                 * @param  {Object}       subtree subtree to be subtree
                 * @param  {Int}          y       starting y position of children
                 * @return {KineticGroup}         Kinetic group of groups to draw
                 */
                $scope.createSubtree = function(subtree, y) {
                    y = (y || 0) + $scope.lineHeight;
                    var group = new Kinetic.Group();
                    if (subtree.node) {
                        var start = $scope.pixelRatio * (subtree.node.pageOpenTime - $scope.leftTime);
                        var end = subtree.node.pageCloseTime ? $scope.pixelRatio * (subtree.node.pageCloseTime - $scope.leftTime): window.innerWidth - $scope.offset;
                        var nodegroup = $scope.createNode(start, end, subtree.node);
                        group.setHeight(group.getHeight() + nodegroup.getHeight());
                        group.add(nodegroup);
                    }
                    if (subtree.children || !subtree.node) {
                        var children = Object.keys(subtree.children || subtree).sort();
                        for (var i = 0, l = children.length; i < l; i++) {
                            var subgroup = $scope.createSubtree((subtree.children || subtree)[children[i]], 0);
                            subgroup.setY(subtree.children ? y : 0);
                            group.add(subgroup);
                            group.setHeight(group.getHeight() + subgroup.getHeight());
                            y = group.getHeight();
                            if (subtree.children) {
                                var path = new Kinetic.Line({
                                    opacity: 0.2,
                                    points: [subgroup.children[0].getX(), 17, subgroup.children[0].getX(), group.getHeight() - 3],
                                    stroke: 'black',
                                    strokeWidth: 1
                                });
                                group.add(path);
                            }
                        }
                    }
                    if (subtree.successor) {
                        group.add($scope.createSubtree(subtree.successor, y));
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
                        points: [0, 15, end - start > 3 ? end === window.innerWidth - $scope.offset ? Math.floor(end - start) : Math.floor(end - start - 2) : 2, 15], // -2px for border between successors
                        stroke: !node.parentId && !node.predecessorId ? 'green': 'blue', // green == root
                        strokeWidth: 4
                    });
                    pageView.on('mouseover', function(event) {
                        $timeout.cancel($scope.popupTimer);
                        var infoWidth = node.pageUrl.length * 7 + 20;

                        // Prevents popups from going off the page.
                        var edgeOffset = (event.pageX - window.innerWidth) + infoWidth;
                        if (edgeOffset < 0) {
                            edgeOffset = 0;
                        } else {
                            edgeOffset += 20;
                        }
                        var infoBox = new Kinetic.Group({
                            x: event.pageX - edgeOffset,
                            y: event.pageY - $('canvas').offset().top
                        });

                        infoBox.on('mouseover', function() {
                            $timeout.cancel($scope.popupTimer);
                        });

                        infoBox.on('mouseout', function() {
                            $scope.popupTimer = $timeout(function() {
                                $scope.layers.popups.children = [];
                                $scope.stage.draw();
                            }, 250);
                        });

                        infoBox.add(new Kinetic.Rect({
                            x: 0,
                            y: 0,
                            width: infoWidth,
                            height: 10,
                            opacity: 0
                        }));

                        infoBox.add(new Kinetic.Rect({
                            x: 0,
                            y: 10,
                            width: infoWidth,
                            height: 35,
                            fill: '#f1f1f1',
                            stroke: 'black',
                            strokeWidth: 2
                        }));

                        infoBox.add(new Kinetic.Text({
                            text: node.pageUrl,
                            fontSize: 13,
                            fontFamily: '"Ubuntu Mono"',
                            fill: '#000',
                            x: 10,
                            y: 10
                        }));

                        $scope.layers.popups.children = [];
                        $scope.stage.draw();
                        $scope.layers.popups.add(infoBox);
                        $scope.layers.popups.moveToTop();
                        $scope.stage.draw();
                    });

                    pageView.on('mouseout', function() {
                        $scope.popupTimer = $timeout(function() {
                            $scope.layers.popups.children = [];
                            $scope.stage.draw();
                        }, 500);
                    });


                    group.add(pageView);

                    var predecessor = node.predecessorId ? $scope.tree.getPageView($scope.tree.vertexIds[node.predecessorId]) : undefined;
                    if ((end > 0 && start < 0) ||
                        !predecessor ||
                        predecessor.pageUrl !== node.pageUrl
                    ) {
                        var domain = node.pageUrl.replace(/^(.*):\/\/|\/.*|www\./g, '') || 'Missing URL';

                        if (predecessor && domain === predecessor.pageUrl.replace(/^(.*):\/\/|\/.*|www\./g, '')) {
                            domain = '';
                        }

                        // truncate URLs longer than node line.
                        domain = domain.substring(0, (end - (start < 0 ? 2 : start)) / 7);

                        var label = new Kinetic.Text({
                            text: domain,
                            fontSize: 13,
                            fontFamily: '"Ubuntu Mono"',
                            fill: end === window.innerWidth - $scope.offset ? '#000' : '#aaa', // black == still open
                            x: start < 2 ? -1 * start : 0 // prevent text from falling off left side of screen
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
                $scope.layers.now = new Kinetic.Layer();
                $scope.layers.now.add(new Kinetic.Line({
                    points: [window.innerWidth - $scope.offset - 1, 0, window.innerWidth - $scope.offset, 10000],
                    stroke: 'red',
                    strokeWidth: 2
                }));
                $scope.stage.add($scope.layers.now);
            },
            controller: Tree
        };
    })

;