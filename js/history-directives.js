/* JSHint: */
/* global Tree */

angular.module('history.directives', ['ngSanitize'])
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
                    if ($scope.dragging && !isNaN($scope.stage.getY())) {
                        $scope.dragging.dy = $scope.stage.getY();
                    }
                    if ($scope.stage.getY() + $scope.tree.height < $scope.viewportHeight) {
                        $scope.stage.setY($scope.viewportHeight - $scope.tree.height);
                    }
                    if ($scope.stage.getY() > 0) {
                        $scope.stage.setY(0);
                    }
                });
                $scope.stage.on('dragend', function(event) {
                    broadcast.send({
                        'action': 'move',
                        'pageX': -(event.pageX - $scope.dragging.x) / $scope.viewportWidth,
                        'scrollY': 0
                    });

                    $scope.stage.setY($scope.dragging.dy);
                    $scope.stage.setX(0);
                    $scope.$apply();
                    delete $scope.dragging;
                });

                $scope.layers = {};

                $scope.viewportWidth = $window.innerWidth;
                angular.element($window).bind('resize load', function() {
                    $scope.$apply(function() {
                        $scope.viewportWidth = $window.innerWidth;
                        $scope.viewportHeight = $window.innerHeight - 71;
                    });
                });

                $scope.$watch('viewportWidth', function(newValue, oldValue) {
                    $scope.stage.setSize({
                        width: newValue
                    });
                });

                // track now time, check every minute
                setInterval(function() {
                    if ($scope.rightTime + 2 * 1000 * 60 > $scope.now()) {
                        // if we are less than 2 minutes from now, track
                        $scope.rightTime = $scope.now();
                        $scope.$apply();
                    }
                }, 1 * 1000 * 60);

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
                    $scope.tree.height = $scope.lineHeight;
                    var roots = Object.keys($scope.tree.built.root).sort();
                    for (var i = 0, l = roots.length; i < l; i++) {
                        var group = $scope.createSubtree($scope.tree.built.root[roots[i]]);
                        group.setY($scope.tree.height);
                        $scope.layers.tree.add(group);
                        $scope.tree.height += group.getHeight() + $scope.lineHeight * 2; // 2: extra margin between windows
                    }
                    $scope.stage.setSize({
                        width: $scope.viewportWidth,
                        height: $scope.viewportHeight
                    });
                    $scope.stage.add($scope.layers.tree);
                };

                $scope.$watch('tree.built', $scope.drawTree, true);
                $scope.$watch('[range, rightTime]', function() {
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
                        var end = subtree.node.pageCloseTime ? $scope.locateTime(subtree.node.pageCloseTime) : window.innerWidth - $scope.offset;
                        var nodegroup = $scope.createNode(start, end, subtree.node);
                        group.setHeight(group.getHeight() + nodegroup.getHeight());
                        group.add(nodegroup);
                    }
                    if (subtree.children || !subtree.node) {
                        var children = Object.keys(subtree.children || subtree).sort();
                        for (var i = 0, l = children.length; i < l; i++) {
                            var subgroup = $scope.createSubtree((subtree.children || subtree)[children[i]]);
                            subgroup.setY(subtree.children ? y : 0);
                            group.setHeight(group.getHeight() + subgroup.getHeight());
                            y = group.getHeight();
                            if (subtree.children) {
                                group.add(new Kinetic.Rect({
                                    x: subgroup.children[0].getX(),
                                    y: 3,
                                    height: group.getHeight() - 15,
                                    opacity: 0.2,
                                    fill: '#000',
                                    width: 1
                                }));
                            }
                            group.add(subgroup);
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
                        y: 0,
                        height: $scope.nodeHeight
                    });

                    var duration = (end - start > 3 ? Math.round(end - start) : 2) + 0;

                    // add transparent background
                    group.add(new Kinetic.Rect({
                        x: 0,
                        y: 0,
                        height: $scope.nodeHeight,
                        fill: '#fff',
                        width: duration
                    }));
                    // add endpoints
                    group.add(new Kinetic.Rect({
                        x: 0,
                        y: 0,
                        height: $scope.nodeHeight,
                        fillLinearGradientStartPoint: [0, 0],
                        fillLinearGradientEndPoint: [0, $scope.nodeHeight],
                        fillLinearGradientColorStops: [
                            0, '#06ABF5',
                            1, '#fff'
                        ],
                        width: 1
                    }));
                    group.add(new Kinetic.Rect({
                        x: duration,
                        y: 0,
                        height: $scope.nodeHeight,
                        fillLinearGradientStartPoint: [0, 0],
                        fillLinearGradientEndPoint: [0, $scope.nodeHeight],
                        fillLinearGradientColorStops: [
                            0, '#06ABF5',
                            1, '#fff'
                        ],
                        width: 1
                    }));
                    // add duration line
                    group.add(new Kinetic.Rect({
                        x: 0,
                        y: 0,
                        height: 3,
                        fill: '#06ABF5',
                        width: duration
                    }));

                    var domain = '';
                    var predecessor = node.predecessorId ? $scope.tree.getPageView($scope.tree.vertexIds[node.predecessorId]) : undefined;
                    if ((end > 0 && start < 0) ||
                        !predecessor ||
                        predecessor.pageUrl !== node.pageUrl
                    ) {
                        domain = node.pageUrl.replace(/^(.*):\/\/|\/.*|www\./g, '') || 'Missing URL';

                        if (predecessor && domain === predecessor.pageUrl.replace(/^(.*):\/\/|\/.*|www\./g, '')) {
                            domain = '';
                        }

                        // truncate URLs longer than node line.
                        //domain = domain.substring(0, (end - (start < 0 ? 2 : start)) / 7);
                    }

                    group.add(new Kinetic.Text({
                        text: domain,
                        fontSize: Math.round($scope.nodeHeight * 0.75),
                        fontFamily: '"Roboto"',
                        fill: '#aaa',
                        x: start < 2 && end > 0 ? Math.ceil(-1 * start) : 5, // prevent text from falling off left side of screen
                        y: 2
                    }));

                    group.on('click', (function(url) {
                        return function(event) {
                            if (event.which === 1) {
                                window.open(url);
                            }
                        };
                    })(node.pageUrl));

                    group.on('mouseover', function(event) {
                        var group = event.targetNode;
                        while (group.nodeType !== 'Group') {
                            group = group.parent;
                        }
                        group.children[0].setFill('#eee');   // background
                        group.children[4].setFill('#000'); // text
                        $scope.layers.tree.draw();
                        $('#tree-container').css({ 'cursor': 'pointer' });
                        // Prevents popups from going off the page.
                        var hasSpace = window.innerWidth - event.pageX - 300 > $scope.nodeHeight;
                        if (isNaN(this.getAbsolutePosition().y)) { console.error('Absolute position broke!'); }
                        broadcast.send({
                            'action': 'showInfoBox',
                            'infoBox': {
                                'id': node.id,
                                'url': node.pageUrl,
                                'style': {
                                    'left': (hasSpace ? event.pageX - 20 : window.innerWidth - 340),
                                    'top': this.getAbsolutePosition().y - $scope.scrollTop + 71 + $scope.nodeHeight
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
                        var group = event.targetNode;
                        while (group.nodeType !== 'Group') {
                            group = group.parent;
                        }
                        group.children[0].setFill('#fff');   // background
                        group.children[4].setFill('#aaa'); // text
                        $scope.layers.tree.draw();
                        $('#tree-container').css({ 'cursor': 'move' });
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