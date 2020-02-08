window.onload = function() {
    var colors = d3.scaleOrdinal(d3.schemeCategory10);

    var nodes = [];
    var links = [];

    var draw = document.getElementById("draw");
    var searchBox = document.getElementById("searchBox");
    var drawRect = draw.getBoundingClientRect(); // get the bounding rectangle
    var nodeTagInput = document.getElementById("node-new-tag-input");
    var linkTagInput = document.getElementById("link-new-tag-input");
    var searchResults = document.getElementById("searchResults");
    var allTags = {};
    var allTagsArray = [];

    var searchLinks = document.getElementById("link-col");
    var searchNodes = document.getElementById("node-col");
    var searchTags = document.getElementById("tags-col");

    //enable autocomplete for tags

    searchBox.oninput = searchBoxValueChanged;
    searchBox.onfocus = searchBoxValueChanged;
    searchBox.onkeydown = function(evt) {
        evt = evt || window.event;
        var isEscape = false;
        if ("key" in evt) {
            isEscape = (evt.key === "Escape" || evt.key === "Esc");
        } else {
            isEscape = (evt.keyCode === 27);
        }
        if (isEscape) {
            searchBox.value = "";
            searchBoxValueChanged();
        }
    };

    nodeTagInput.addEventListener("keyup", function(event) {
        // Number 13 is the "Enter" key on the keyboard
        if (event.keyCode === 13) {
            // Cancel the default action, if needed
            event.preventDefault();
            // Trigger the button element with a click
            addNewTagToNode();
        }
    });

    linkTagInput.addEventListener("keyup", function(event) {
        if (event.keyCode === 13) {
            event.preventDefault();
            addNewTagToLink();
        }
    });

    document.getElementById("node-btn-add-tag").onclick = addNewTagToNode;

    var state = {
        selectedNode: null,
        selectedLink: null,
        lastKeyDown: -1,
        graphMouseDown: false,
        shiftNodeDrag: false,
        dragNode: null
    };

    var consts = {
        DELETE_KEY: 46,
        ENTER_KEY: 13
    };

    var zoom = d3.zoom()
        .filter(function() {
            switch (d3.event.type) {
                case "mousedown":
                    return (d3.event.button === 1 || d3.event.altKey);
                case "wheel":
                    return d3.event.button === 0;
                default:
                    return false;
            }
        })
        .on("zoom", function() {
            svg.attr("transform", d3.event.transform)
        }),
        root = d3.select("svg"),
        svg = root.call(zoom).append("g"),
        width = drawRect.width,
        height = window.innerHeight,
        node,
        link;

    root.attr("height", height);
    root.on("mousedown", mouseDownGraph);
    root.on("mouseup", mouseUpGraph);
    d3.select(window).on("keydown", function() {
            svgKeyDown();
        })
        .on("keyup", function() {
            svgKeyUp();
        });

    document.getElementById("node-select-save").onclick = saveDataNode;
    document.getElementById("link-select-save").onclick = saveDataLink;

    root.append('defs').append('marker')
        .attrs({
            'id': 'arrowhead',
            'viewBox': '-0 -5 10 10',
            'refX': 13,
            'refY': 0,
            'orient': 'auto',
            'markerWidth': 13,
            'markerHeight': 13,
            'xoverflow': 'visible'
        })
        .append('svg:path')
        .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
        .attr('fill', '#999')
        .style('stroke', 'none');

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function(d) {
            return d.id;
        }).distance(100).strength(1))
        .force("charge", d3.forceManyBody())
        .force("center", d3.forceCenter(width / 2, height / 2));

    var linkedByIndex = {};

    d3.json("graph.json", function(error, graph) {
        if (error) throw error;
        links = graph.links;
        nodes = graph.nodes;
        update();
    });

    var links = simulation.force("link").links();
    var nodes = simulation.nodes();

    var getSiblingLinks = function(source, target) {
        var links = simulation.force("link").links();
        var siblings = [];
        for (var i = 0; i < links.length; ++i) {
            if ((links[i].source.id == source.id && links[i].target.id == target.id) || (links[i].source.id == target.id && links[i].target.id == source.id))
                siblings.push(links[i]);
        };
        return siblings;
    };

    var getSiblingTexts = function(sib) {
        texts = [];
        for (var i = 0; i < sib.length; ++i) {
            texts.push(sib[i].type);
        }
        return texts;
    };

    var mouseOverLink = function(d, check = true) {
        if (check) {
            if (state.selectedLink != null) {
                return;
            }
            if (state.selectedNode != null) {
                return;
            }
        } //do nothing if an object is selected 
        node
            .transition(500)
            .style("opacity", function(o) {
                return d.source.id == o.id || d.target.id == o.id ? 1.0 : 0.2;
            });

        edgelabels
            .transition(500)
            .style("opacity", function(o) {
                return o.index == d.index ? 1 : 0.2;
            });

        link
            .transition(500)
            .style("stroke-opacity", function(o) {
                return o.index == d.index ? 1 : 0.2;
            });
    };

    var mouseOutLink = function(d, check = true) {
        if (check) {
            if (state.selectedLink != null) {
                return;
            }
            if (state.selectedNode != null) {
                return;
            }
        }
        deselectEverything();
    };

    function deselectEverything() {
        state.selectedNode = null;
        state.selectedLink = null;

        node
            .transition(500)
            .style("opacity", 1)
            .each(function(d) {
                this.children[0].style.fill = d.color;
            });

        edgelabels
            .transition(500)
            .style("opacity", 1);

        link
            .transition(500)
            .style("stroke-opacity", 1)
            .style("stroke", "#999");

        document.getElementById("node-select").style.display = "none";
        document.getElementById("link-select").style.display = "none";
        searchResults.style.display = "none";
    }

    function searchBoxValueChanged() {
        deselectEverything();
        //Generate the regular expression
        var searchString = new RegExp(searchBox.value, "i");
        var nodesColor = {};
        var linksColor = {};

        var listNodes = [];
        var listLinks = [];

        var tags = {};
        node
            .transition(500)
            .style("opacity", function(o) {
                var found = false;
                if (o.tags) {
                    for (var key in o.tags) {
                        if (searchString.test(key)) {
                            nodesColor[o.id] = allTags[key];
                            this.children[0].style.fill = allTags[key];
                            if (!(key in tags)) {
                                tags[key] = {};
                                tags[key].color = allTags[key];
                                tags[key].items = [];
                            }
                            tags[key].items.push({ data: o, type: "node" });
                            found = true;
                        }
                    }
                }
                if (o.name) {
                    if (searchString.test(o.name)) {
                        nodesColor[o.id] = o.color;
                        this.children[0].style.fill = o.color;
                        listNodes.push(o);
                        found = true;
                    }
                }
                if (found) return 1.0;
                return 0.2;
            });

        edgelabels
            .transition(500)
            .style("opacity", function(o) {
                if (o.type) {
                    if (searchString.test(o.type)) {
                        return 1.0;
                    }
                }
                if (o.tags) {
                    for (var key in o.tags) {
                        if (searchString.test(key)) {
                            return 1.0;
                        }
                    }
                }
                return 0.2;
            });
        link
            .transition(500)
            .style("stroke-opacity", function(o) {
                var found = false;
                //TODO : optimise this
                for (var key in o.tags) {
                    if (searchString.test(key)) {
                        linksColor[o.type] = allTags[key];
                        this.style.stroke = allTags[key];
                        if (!(key in tags)) {
                            tags[key] = {};
                            tags[key].color = allTags[key];
                            tags[key].items = [];
                        }
                        tags[key].items.push({ data: o, type: "link" });
                        found = true;
                    }
                }
                if (o.type) {
                    if (searchString.test(o.type)) {
                        linksColor[o.type] = "#999";
                        this.style.stroke = "#999";
                        listLinks.push(o);
                        found = true;
                    }
                }
                if (found) return 1.0;
                return 0.2;
            });

        searchResults.style.display = "inline";
        //searchResults.innerHTML = "";

        searchLinks.innerHTML = "";
        searchNodes.innerHTML = "";
        searchTags.innerHTML = "";


        for (var i = 0; i < listNodes.length; i++) {
            var newTag = document.createElement("div");
            newTag.className = "card-body";
            newTag.innerHTML = listNodes[i].name;
            newTag.style.backgroundColor = nodesColor[listNodes[i].id];
            $(newTag).bind("click", {
                id: listNodes[i].id
            }, function(event) {
                nodeSearchClick(event.data.id);
            });
            searchNodes.appendChild(newTag);
        }
        for (var i = 0; i < listLinks.length; i++) {
            var newTag = document.createElement("div");
            newTag.className = "card-body";
            newTag.innerHTML = listLinks[i].type;
            newTag.style.backgroundColor = linksColor[listLinks[i].type];
            $(newTag).bind("click", {
                index: listLinks[i].index
            }, function(event) {
                linkSearchClick(event.data.index);
            });
            searchLinks.appendChild(newTag);
        }

        for (key in tags) {
            var badge = document.createElement("span");
            badge.className = "tag badge badge-pill badge-primary";
            badge.innerHTML = tags[key].items.length;
            newTag = document.createElement("div");
            newTag.className = "card-body";
            newTag.innerHTML = key;
            newTag.appendChild(badge);
            newTag.style.backgroundColor = allTags[key];
            $(newTag).bind("click", {
                tag: key
            }, function(event) {
                tagSearchClick(event.data.tag);
            });
            searchTags.appendChild(newTag);
        }
    }

    function nodeSearchClick(nodeid) {
        var onclicknode = getNode(nodeid);
        deselectEverything();
        mouseOverFunction(onclicknode, false);
        state.selectedNode = onclicknode;
        state.selectedLink = null;
        setupUIForNode();
    }

    function linkSearchClick(linkindex) {
        var onclicklink = links[linkindex];
        deselectEverything();
        mouseOverLink(onclicklink, false);
        state.selectedNode = null;
        state.selectedLink = onclicklink;
        setupUIForLink();
    }

    function tagSearchClick(key) {
        searchBox.value = key;
        searchBoxValueChanged();
    }

    var mouseDownLink = function(d) {
        d3.event.stopPropagation();
        var prevEdge = state.selectedLink;
        if (!prevEdge || prevEdge !== d) {
            deselectEverything();
            mouseOverLink(d, false)
            state.selectedLink = d;
            state.selectedNode = null;
            setupUIForLink();
        } else {
            deselectEverything();
        }
    };

    function setupUIForLink() {
        if (!state.selectedLink) return;
        document.getElementById("link-select").style.display = "inline";
        document.getElementById("link-select-name").value = state.selectedLink.type;
        document.getElementById("link-select-desc").value = (state.selectedLink.description) ? state.selectedLink.description : "";
        document.getElementById("link-select-from").value = state.selectedLink.source.name;
        document.getElementById("link-select-to").value = state.selectedLink.target.name;

        tagsHolder = document.getElementById("link-tags-holder");
        tagsHolder.innerHTML = "";
        linkTagInput.value = "";

        if ("tags" in state.selectedLink) {
            for (var key in state.selectedLink.tags) {
                var newTag = document.createElement("span");
                newTag.className = "tag badge badge-pill badge-primary";
                newTag.innerHTML = key;
                newTag.style.backgroundColor = allTags[key];
                tagsHolder.appendChild(newTag);
            }
        }
    }

    function setupUIForNode() {
        if (!state.selectedNode) return;
        document.getElementById("node-select").style.display = "inline";
        document.getElementById("node-select-name").value = state.selectedNode.name;
        document.getElementById("node-select-desc").value = (state.selectedNode.description) ? state.selectedNode.description : "";
        tagsHolder = document.getElementById("node-tags-holder");
        tagsHolder.innerHTML = "";
        nodeTagInput.value = "";

        if ("tags" in state.selectedNode) {
            for (var key in state.selectedNode.tags) {
                var newTag = document.createElement("span");
                newTag.className = "tag badge badge-pill badge-primary";
                newTag.innerHTML = key;
                newTag.style.backgroundColor = state.selectedNode.tags[key];
                tagsHolder.appendChild(newTag);
            }
        }
    }

    function saveDataNode() {
        state.selectedNode.name = document.getElementById("node-select-name").value;
        state.selectedNode.description = document.getElementById("node-select-desc").value;
        update();
    }

    function saveDataLink() {
        state.selectedLink.type = document.getElementById("link-select-name").value;
        state.selectedLink.description = document.getElementById("link-select-desc").value;
        update();
    }

    var mouseOverFunction = function(d, check = true) {
        if (check) {
            if (state.selectedLink != null) {
                return;
            }
            if (state.selectedNode != null) {
                return;
            }
        }

        node
            .transition(500)
            .style("opacity", function(o) {
                return isConnected(o, d) ? 1.0 : 0.2;
            });

        edgelabels
            .transition(500)
            .style("opacity", function(o) {
                return o.source === d || o.target === d ? 1 : 0.2;
            });

        link
            .transition(500)
            .style("stroke-opacity", function(o) {
                return o.source === d || o.target === d ? 1 : 0.2;
            });
    }

    var mouseOutFunction = function(d, check = true) {
        if (check) {
            if (state.selectedLink != null) {
                return;
            }
            if (state.selectedNode != null) {
                return;
            }
        }
        node
            .transition(500)
            .style("opacity", 1);

        link
            .transition(500)
            .style("stroke-opacity", 1.0);


        edgelabels
            .transition(500)
            .style("opacity", 1.0);

    }

    function mouseDownGraph() {
        state.graphMouseDown = true;
    }

    function mouseUpGraph(d) {
        if (state.selectedLink != null || state.selectedNode != null) {
            searchBox.value = "";
            searchBoxValueChanged();
            deselectEverything();
        } else if (state.shiftNodeDrag) {
            state.shiftNodeDrag = false;
            state.dragNode = null;
            dragLine.classed('hidden', true);
            //Disable the line here too if the user doesnt connect to the nodes
        } else if (state.graphMouseDown && d3.event.ctrlKey) {
            // clicked not dragged from svg
            var xycoords = d3.mouse(svg.node()),
                d = {
                    id: nodes[nodes.length - 1].id + 1,
                    name: "New Node",
                    x: xycoords[0],
                    y: xycoords[1]
                };
            nodes.push(d);
            update();
        }
    }

    function isConnected(a, b) {
        return isConnectedAsTarget(a, b) || isConnectedAsSource(a, b) || a.index == b.index;
    }

    function isConnectedAsSource(a, b) {
        return linkedByIndex[a.index + "," + b.index];
    }

    function isConnectedAsTarget(a, b) {
        return linkedByIndex[b.index + "," + a.index];
    }


    var dragLine = null;

    function update() {
        //clear all objects
        d3.selectAll("g > *").remove();
        //update the links dict

        link = svg.selectAll(".link")
            .data(links)
            .enter()
            .append("path")
            .attr("class", "link")
            .attr('marker-end', 'url(#arrowhead)')
            .attr("fill", "none")
            .on("mouseover", function(d) {
                mouseOverLink(d, true);
            })
            .on("mouseout", function(d) {
                mouseOutLink(d, true);
            })
            .on("mousedown", mouseDownLink)
            .on("mouseup", function(d) {
                d3.event.stopPropagation();
                if (state.shiftNodeDrag) {
                    state.shiftNodeDrag = false;
                    state.dragNode = null;
                    dragLine.classed('hidden', true)
                        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
                }
            });

        link.append("title")
            .text(function(d) {
                return d.type;
            });

        link.exit().remove();

        edgepaths = svg.selectAll(".edgepath")
            .data(links)
            .enter()
            .append('path')
            .attrs({
                'class': 'edgepath',
                'fill-opacity': 0,
                'stroke-opacity': 0,
                'id': function(d, i) {
                    return 'edgepath' + i
                }
            })
            .style("pointer-events", "none");

        edgepaths.exit().remove();

        edgelabels = svg.selectAll(".edgelabel")
            .data(links)
            .enter()
            .append('text')
            .style("pointer-events", "none")
            .attrs({
                'class': 'edgelabel',
                'id': function(d, i) {
                    return 'edgelabel' + i
                },
                'font-size': 10,
                'fill': '#aaa'
            });

        edgelabels.append('textPath')
            .attr('xlink:href', function(d, i) {
                return '#edgepath' + i
            })
            .style("text-anchor", "middle")
            .style("pointer-events", "none")
            .attr("startOffset", "50%")
            .text(function(d) {
                return d.type
            });

        edgelabels.exit().remove();

        node = svg.selectAll(".node")
            .data(nodes)
            .enter()
            .append("g")
            .attr("class", "node")
            .on("mousedown", mouseDownNode)
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                //.on("end", dragended)
            );

        node.append("circle")
            .attr("r", 10)
            .style("fill", function(d, i) {
                if (!d.color) {
                    d.color = randomColor();
                }
                return d.color;
            })
            .on("mouseover", function(d) {
                mouseOverFunction(d, true);
            })
            .on("mouseout", function(d) {
                mouseOutFunction(d, true);
            });


        node.append("title")
            .text(function(d) {
                return d.id;
            });

        node.append("text")
            .attr("dy", -3)
            .text(function(d) {
                return d.name;
            });

        node.exit().remove();

        dragLine = svg.append('g')
            .append("path")
            .attr("class", "fakelink hidden")
            .attr('marker-end', 'url(#arrowhead)')
            .attr("fill", "none")
            .attr('d', 'M10,10L0,0')

        simulation.nodes(nodes).on("tick", ticked);
        simulation.force("link").links(links);
        simulation.alpha(1).restart();

        linkedByIndex = {};
        links.forEach(function(d) {
            linkedByIndex[d.source.index + "," + d.target.index] = true;
            if ("tags" in d) {
                for (var key in d.tags) {
                    //TODO: fix bug here where initially same tags on different objects can have different color
                    allTags[key] = d.tags[key];
                }
            }
        });
        nodes.forEach(function(newNode) {
            if ("tags" in newNode) {
                for (var key in newNode.tags) {
                    //TODO: fix bug here where initially same tags on different objects can have different color
                    allTags[key] = d.tags[key];
                }
            }
        });
        allTagsArray = Object.keys(allTags);
        updateTags();
    }

    function getNode(id) {
        for (i = 0; i < nodes.length; i++) {
            if (nodes[i].id == id) {
                return nodes[i];
            }
        }
    }

    function arcPath(leftHand, d) {
        var siblings = getSiblingLinks(d.source, d.target);
        var siblingCount = siblings.length;
        if (siblingCount == 1) {
            return 'M ' + d.source.x + ' ' + d.source.y + ' L ' + d.target.x + ' ' + d.target.y;
        }

        var x1 = leftHand ? d.source.x : d.target.x,
            y1 = leftHand ? d.source.y : d.target.y,
            x2 = leftHand ? d.target.x : d.source.x,
            y2 = leftHand ? d.target.y : d.source.y,
            dx = x2 - x1,
            dy = y2 - y1,
            dr = Math.sqrt(dx * dx + dy * dy),
            drx = dr,
            dry = dr,
            sweep = leftHand ? 0 : 1;
        xRotation = 0,
            largeArc = 0;

        if (siblingCount > 1) {
            var sibTexts = getSiblingTexts(siblings);
            var arcScale = d3.scaleBand().domain(sibTexts).range([0, siblingCount]);
            drx = drx / (1.5 + (1 / siblingCount) * (arcScale(d.type) - 1));
            dry = dry / (1.5 + (1 / siblingCount) * (arcScale(d.type) - 1));
        }

        return "M" + x1 + "," + y1 + "A" + drx + ", " + dry + " " + xRotation + ", " + largeArc + ", " + sweep + " " + x2 + "," + y2;
    }

    function ticked() {
        link
            .attr("d", function(d) {
                return arcPath(true, d);
            });

        node
            .attr("transform", function(d) {
                return "translate(" + d.x + ", " + d.y + ")";
            });

        edgepaths.attr('d', function(d) {
            return arcPath(d.source.x < d.target.x, d)
        });

        edgelabels.attr('transform', function(d) {
            if (getSiblingLinks(d.source, d.target).length == 1) {
                if (d.target.x < d.source.x) {
                    var bbox = this.getBBox();

                    rx = bbox.x + bbox.width / 2;
                    ry = bbox.y + bbox.height / 2;
                    return 'rotate(180 ' + rx + ' ' + ry + ')';
                } else {
                    return 'rotate(0)';
                }
            }
        });
    }

    function dragstarted(d) {
        if (!state.shiftNodeDrag) {
            if (!d3.event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
            var prevNode = state.selectedNode;
            if (!prevNode || prevNode !== d) {
                deselectEverything();
                mouseOverFunction(d, false);
                state.selectedNode = d;
                state.selectedLink = null;
                setupUIForNode();
            } else {
                deselectEverything();
            }
        }
    }

    function mouseDownNode(d) {
        d3.event.stopPropagation();
        if (d3.event.shiftKey) {
            if (state.shiftNodeDrag) {
                dragLine.classed("hidden,true");
                if (state.dragNode !== d) {
                    // we're in a different node: create new edge for mousedown edge and add to graph
                    var newEdge = {
                        source: state.dragNode.id,
                        target: d.id,
                        type: "New Link" + links.length
                    };
                    links.push(newEdge);
                    update();
                }
                state.shiftNodeDrag = false;
                state.dragNode = null;
            } else {
                //enable line
                dragLine.classed('hidden', false)
                    .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
                state.shiftNodeDrag = d3.event.shiftKey;
                state.dragNode = d;
            }
        }
    }

    function dragged(d) {
        if (state.shiftNodeDrag) {
            var x = d3.mouse(svg.node())[0],
                y = d3.mouse(svg.node())[1] - 3
            dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + x + ',' + y);
        } else {
            d.fx = d3.event.x;
            d.fy = d3.event.y;
        }
    }

    function svgKeyUp() {
        state.lastKeyDown = -1;
    }

    function svgKeyDown() {
        // make sure repeated key presses don't register for each keydown
        if (state.lastKeyDown !== -1) return;

        state.lastKeyDown = d3.event.keyCode;
        var selectedNode = state.selectedNode,
            selectedEdge = state.selectedLink;


        switch (d3.event.keyCode) {
            case consts.BACKSPACE_KEY:
            case consts.DELETE_KEY:
                d3.event.preventDefault();
                if (selectedNode) {
                    nodes.splice(nodes.indexOf(selectedNode), 1);
                    spliceLinksForNode(selectedNode);
                    state.selectedNode = null;
                    update();
                } else if (selectedEdge) {
                    links.splice(links.indexOf(selectedEdge), 1);
                    state.selectedEdge = null;
                    update();
                }
                break;
        }
    }

    function addNewTagToNode() {
        var tagInput = nodeTagInput.value.toLowerCase();
        if (state.selectedNode) {
            if (!("tags" in state.selectedNode)) {
                state.selectedNode["tags"] = {};
            }
            if (tagInput === "") {
                return;
            }
            if (tagInput in state.selectedNode.tags) {
                return;
            }
            if (tagInput in allTags) {
                state.selectedNode.tags[tagInput] = allTags[tagInput];
            } else {
                var newColor = randomColor();
                state.selectedNode.tags[tagInput] = newColor;
                allTags[tagInput] = newColor;
                allTagsArray = Object.keys(allTags);
                updateTags();
            }
        }
        setupUIForNode();
    }

    function addNewTagToLink() {
        var tagInput = linkTagInput.value.toLowerCase();
        if (state.selectedLink) {
            if (!("tags" in state.selectedLink)) {
                state.selectedLink["tags"] = {};
            }
            if (tagInput === "") {
                return;
            }
            if (tagInput in state.selectedLink.tags) {
                return;
            }
            if (tagInput in allTags) {
                state.selectedLink.tags[tagInput] = allTags[tagInput];
            } else {
                var newColor = randomColor();
                state.selectedLink.tags[tagInput] = newColor;
                allTags[tagInput] = newColor;
                allTagsArray = Object.keys(allTags);
                updateTags();
            }
        }
        setupUIForLink();
    }

    spliceLinksForNode = function(node) {
        var toSplice = links.filter(function(l) {
            return (l.source === node || l.target === node);
        });
        toSplice.map(function(l) {
            links.splice(links.indexOf(l), 1);
        });
    };

    function updateTags() {
        $(function() {
            $("#node-new-tag-input").autocomplete({
                source: allTagsArray
            });
            //enable autocomplete for tags
            $("#link-new-tag-input").autocomplete({
                source: allTagsArray
            });
        });
    }

    //Copy from here later http://bl.ocks.org/GerHobbelt/3071239
    //TODO: save changes on enter click 
}