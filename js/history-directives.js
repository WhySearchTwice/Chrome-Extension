/* JSHint: */
/* global Tree */

angular.module('history.directives', [])
    .directive('kinetic', function($window, $location, broadcast) {
        return {
            restrict: 'E',
            replace: true,
            template: '<div id="container"></div>',
            link:function postLink($scope, iElement, iAttrs) {
                // create stage
                $scope.stage = new Kinetic.Stage({
                    container: 'container',
                    draggable: true,
                    width: window.innerWidth,
                    height: window.innerHeight - $('.navbar').outerHeight()
                });

                // handle click and drag
                $scope.stage.on('dragstart', function(event) {
                    $scope.dragging = {
                        'x': event.pageX,
                        'y': event.pageY
                    };
                });
                $scope.stage.on('dragmove', function(event) {
                    // don't allow vertical panning
                    $scope.stage.setY(0);
                });
                $scope.stage.on('dragend', function(event) {
                    broadcast.send({
                        'action': 'page',
                        'pageAmount': (event.pageX - $scope.dragging.x) / $scope.viewportWidth
                    });
                    $scope.stage.setX(0);
                    delete $scope.dragging;
                });

                $scope.layers = {};

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
                    $scope.leftTime = $scope.rightTime - (1000 * 60 * $scope.range);                            // leftTime = now - range in ms
                    if ($scope.layers.tree) {
                        $scope.layers.tree.removeChildren();
                    } else {
                        $scope.layers.tree = new Kinetic.Layer();
                    }
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
                };

                $scope.$watch('tree.built', $scope.drawTree, true);
                $scope.$watch('[range, rightTime]', function() {
                    console.log('moved');
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
                        var start = $scope.locateTime(subtree.node.pageOpenTime);
                        var end = subtree.node.pageCloseTime ? $scope.locateTime(subtree.node.pageCloseTime): window.innerWidth - $scope.offset;
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
                                var position = subgroup.children[0].getX() + 0.5;
                                var path = new Kinetic.Line({
                                    opacity: 0.2,
                                    points: [position, 16, position, group.getHeight() - 7], // 7px for endcap
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
                        x: Math.round(start),
                        y: 0.5,
                        height: 20
                    });

                    var duration = (end - start > 3 ? Math.round(end - start) : 2) + 0.5;

                    // add transparent background
                    group.add(new Kinetic.Rect({
                        x: 0,
                        y: 0,
                        height: 15,
                        width: duration
                    }));
                    // add duration line
                    group.add(new Kinetic.Line({
                        points: [0, 15, duration, 15],
                        stroke: '#000',
                        strokeWidth: 1
                    }));
                    // add endpoints
                    group.add(new Kinetic.Line({
                        points: [0.5, 12, 0.5, 17],
                        stroke: '#000',
                        strokeWidth: 1
                    }));
                    group.add(new Kinetic.Line({
                        points: [duration, 12, duration, 17],
                        stroke: '#000',
                        strokeWidth: 1
                    }));

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
                            fontSize: 14,
                            fontFamily: '"Roboto"',
                            fill: '#000',
                            x: start < 2 ? Math.ceil(-1 * start) : 2 // prevent text from falling off left side of screen
                        });
                        group.add(label);
                    }

                    group.on('click', (function(url) {
                        return function(event) {
                            if (event.which === 1) {
                                window.open(url);
                            }
                        }
                    })(node.pageUrl));

                    group.on('mouseover', function(event) {
                        $('#tree-container').css({ 'cursor': 'pointer' });
                        // Prevents popups from going off the page.
                        var hasSpace = window.innerWidth - event.pageX - 300 > 20;
                        broadcast.send({
                            'action': 'showInfoBox',
                            'infoBox': {
                                'id': node.id,
                                'url': node.pageUrl,
                                'style': {
                                    'left': (hasSpace ? event.pageX - 20 : window.innerWidth - 340),
                                    'top': this.getAbsolutePosition().y - $scope.scrollTop + 71 + 15 // 71 for header, 15 for node height
                                }
                            }
                        });

                        // show range selections
                        var data = {
                            'action': 'moveSelection',
                            'selections': []
                        };
                        if (node.pageOpenTime > $scope.leftTime) {
                            data.selections.push({
                                'selection': node.pageOpenTime,
                                'pageX': $scope.locateTime(node.pageOpenTime)
                            });
                        }
                        if (node.pageCloseTime < $scope.rightTime) {
                            data.selections.push({
                                'selection': node.pageCloseTime,
                                'pageX': $scope.locateTime(node.pageCloseTime)
                            });
                        }
                        broadcast.send(data);
                    });
                    group.on('mouseout', function() {
                        $('#tree-container').css({ 'cursor': 'ew-resize' });
                        broadcast.send({ 'action': 'hideInfoBox' });
                    });

                    return group;
                };

                /**
                 * Returns the pixel position for a timestamp
                 * @author ansel
                 * @return {int} Pixel position for timestamp
                 */
                $scope.locateTime = function(timestamp) {
                    return Math.round($scope.pixelRatio * (timestamp - $scope.leftTime));
                };
            },
            controller: Tree
        };
    })
    .directive('ngKeyup', function() {
        return function(scope, elm, attrs) {
            elm.bind('keyup', function(event) {
                scope.$apply(scope.onKeyup(event));
            });
        };
    })
;