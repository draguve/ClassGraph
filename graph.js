window.onload = function(){
    root.attr("height",height);
}

var colors = d3.scaleOrdinal(d3.schemeCategory10);

var nodes=[];
var links=[];

var draw   = document.getElementById("draw")
var drawRect = draw.getBoundingClientRect(); // get the bounding rectangle

var state = {
    selectedNode: null,
    selectedLink: null,
    lastKeyDown: -1,
    graphMouseDown: false,
    shiftNodeDrag: false,
    dragNode: null,
    lastKeyDown:-1
};

var consts =  {
    DELETE_KEY: 46,
    ENTER_KEY: 13
};

var zoom = d3.zoom()
    .filter(function () {
        switch (d3.event.type) {
            case "mousedown": return (d3.event.button === 1 || d3.event.altKey)
            case "wheel": return d3.event.button === 0
            default:
            return false;
        }
    })
    .on("zoom", function() {
        svg.attr("transform", d3.event.transform)
        //http://bl.ocks.org/eyaler/10586116 //copy
    }),
    root = d3.select("svg"),
    svg = root.call(zoom).append("g"),
    width = drawRect.width,
    height = window.innerHeight,
    node,
    link;

root.on("mousedown",mouseDownGraph);
root.on("mouseup",mouseUpGraph);
d3.select(window).on("keydown", function(){
      svgKeyDown();
    })
    .on("keyup", function(){
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
})

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
    texts = []
    for (var i = 0; i < sib.length; ++i) {
        texts.push(sib[i].type);
    };
    return texts;
}

var mouseOverLink = function(d,check = true){
    if(check){
        if(state.selectedLink!=null){
            return;
        }
        if(state.selectedNode!=null){
            return;
        }
    }//do nothing if an object is selected 
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
}

var mouseOutLink = function(d,check = true){
    if(check){
        if(state.selectedLink!=null){
            return;
        }
        if(state.selectedNode!=null){
            return;
        }
    }
    deselectEverything();
}

function deselectEverything(){
    state.selectedNode = null;
    state.selectedLink = null;
    node
        .transition(500)
        .style("opacity", 1);
    
    edgelabels
        .transition(500)
        .style("opacity",1);

    link
        .transition(500)
        .style("stroke-opacity", 1);

    document.getElementById("node-select").style.display = "none";
    document.getElementById("link-select").style.display = "none";

}

var mouseDownLink = function(d){
    d3.event.stopPropagation();

//    need to implement node selection
//    if (state.selectedNode){
//      thisGraph.removeSelectFromNode();
//    }
    var prevEdge = state.selectedLink;
    if (!prevEdge || prevEdge !== d){
        deselectEverything();
        mouseOverLink(d,false)
        state.selectedLink = d;
        state.selectedNode = null;
        setupUIForLink();
    } else{
        deselectEverything();
    }
}

function setupUIForLink(){
    if(!state.selectedLink) return;
    document.getElementById("link-select").style.display = "inline";
    document.getElementById("link-select-name").value = state.selectedLink.type;
    document.getElementById("link-select-desc").value = (state.selectedLink.description) ? state.selectedLink.description : "";
    document.getElementById("link-select-from").value = state.selectedLink.source.name;
    document.getElementById("link-select-to").value = state.selectedLink.target.name;
}

function setupUIForNode(){
    if(!state.selectedNode) return;
    document.getElementById("node-select").style.display = "inline";
    document.getElementById("node-select-name").value = state.selectedNode.name;
    document.getElementById("node-select-desc").value = (state.selectedNode.description) ? state.selectedNode.description : "";
}

function saveDataNode(){
    state.selectedNode.name = document.getElementById("node-select-name").value;
    state.selectedNode.description = document.getElementById("node-select-desc").value;
    update();
}

function saveDataLink(){
    state.selectedLink.type = document.getElementById("link-select-name").value;
    state.selectedLink.description = document.getElementById("link-select-desc").value;
    update();
}

var mouseOverFunction = function(d,check = true) {
    if(check){
        if(state.selectedLink!=null){
            return;
        }
        if(state.selectedNode!=null){
            return;
        }
    }
    //var circle = d3.select(this);

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

    //circle
    //    .transition(500)
    //    .attr("r", function() {
    //        return 1.4 * 10
    //    });
}

var mouseOutFunction = function(d,check = true) {
    if(check){
        if(state.selectedLink!=null){
            return;
        }
        if(state.selectedNode!=null){
            return;
        }
    }
    //var circle = d3.select(this);
    node
        .transition(500)
        .style("opacity", 1);

    link
        .transition(500)
        .style("stroke-opacity", 1.0);

    //circle
    //    .transition(500)
    //    .attr("r", 10);

    edgelabels
        .transition(500)
        .style("opacity", 1.0);

}

function mouseDownGraph(){
    state.graphMouseDown = true;
};

function mouseUpGraph(d){
    if(state.selectedLink!=null || state.selectedNode!=null){
        deselectEverything();
    } else if(state.shiftNodeDrag){
        state.shiftNodeDrag = false;
        state.dragNode = null;
        dragLine.classed('hidden', true);
        //Disable the line here too if the user doesnt connect to the nodes
    }else if (state.graphMouseDown && d3.event.ctrlKey){
      // clicked not dragged from svg
      var xycoords = d3.mouse(svg.node()),
          d = {id: nodes[nodes.length-1].id+1, name: "New Node", x: xycoords[0], y: xycoords[1]};
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
    d3.selectAll("g > *").remove()
    //update the links dict

    link = svg.selectAll(".link")
        .data(links)
        .enter()
        .append("path")
        .attr("class", "link")
        .attr('marker-end', 'url(#arrowhead)')
        .attr("fill", "none")
        .on("mouseover", function(d){mouseOverLink(d,true);})
        .on("mouseout", function(d){mouseOutLink(d,true);})
        .on("mousedown",mouseDownLink)
        .on("mouseup",function(d){ 
            d3.event.stopPropagation(); 
            if(state.shiftNodeDrag){
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
        .on("mousedown",mouseDownNode)
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            //.on("end", dragended)
        );

    node.append("circle")
        .attr("r", 10)
        .style("fill", function(d, i) {
            return colors(i);
        })
        .on("mouseover", function(d){mouseOverFunction(d,true);})
        .on("mouseout", function(d){mouseOutFunction(d,true);});
        

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
    });
}

function getNode(id){
    for (i = 0; i < nodes.length; i++) { 
        if(nodes[i].id == id){
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
    if(!state.shiftNodeDrag){
        if (!d3.event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x;
        d.fy = d.y;
        var prevNode = state.selectedNode;
        if (!prevNode || prevNode !== d){
            deselectEverything();
            mouseOverFunction(d,false);
            state.selectedNode = d;
            state.selectedLink = null;
            setupUIForNode();
        } else{
            deselectEverything();
        }
    }
}

function mouseDownNode(d){
    d3.event.stopPropagation();
    if (d3.event.shiftKey){
        if(state.shiftNodeDrag){
            dragLine.classed("hidden,true");
             if (state.dragNode !== d){
            // we're in a different node: create new edge for mousedown edge and add to graph
                var newEdge = {source: state.dragNode.id, target: d.id , type: "New Link"+links.length };
                links.push(newEdge);
                update();
            }
            state.shiftNodeDrag = false;
            state.dragNode = null;
        }else{
            //enable line
            dragLine.classed('hidden', false)
                .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
            state.shiftNodeDrag = d3.event.shiftKey;
            state.dragNode = d;
        }
    }
}

function dragged(d) {
    if (state.shiftNodeDrag){
        var x=d3.mouse(svg.node())[0],
        y=d3.mouse(svg.node())[1]-3
      dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + x + ',' + y);
    }else{    
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }
}

function svgKeyUp() {
    state.lastKeyDown = -1;
}

function svgKeyDown(){
    // make sure repeated key presses don't register for each keydown
    if(state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
        selectedEdge = state.selectedLink;
    

    switch(d3.event.keyCode) {
    case consts.BACKSPACE_KEY:
    case consts.DELETE_KEY:
      d3.event.preventDefault();
      if (selectedNode){
        nodes.splice(nodes.indexOf(selectedNode), 1);
        spliceLinksForNode(selectedNode);
        state.selectedNode = null;
        update();
      } else if (selectedEdge){
        links.splice(links.indexOf(selectedEdge), 1);
        state.selectedEdge = null;
        update();
      }
      break; 
    }
}

spliceLinksForNode = function(node) {
    var toSplice = links.filter(function(l) {
      return (l.source === node || l.target === node);
    });
    toSplice.map(function(l) {
      links.splice(links.indexOf(l), 1);
    });
}

//Copy from here https://github.com/metacademy/directed-graph-creator;
//Copy from here later http://bl.ocks.org/GerHobbelt/3071239

//    function dragended(d) {
//        if (!d3.event.active) simulation.alphaTarget(0);
//        d.fx = undefined;
//        d.fy = undefined;
//    }
