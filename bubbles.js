paper.install(window); // this makes view, project, and all paper.js classes global
window.onload = function() {
    paper.setup("myCanvas"); // sets up the canvas html element
    var svg = project.importSVG(document.getElementById("svg327")); // TODO better imports
    svg.visible = true;
    svg.strokeColor = "red";
    svg.strokeSize = 10;
    svg.fitBounds(view.bounds);
    var outline = svg.children[1].children[0]; // get the actual path out of the SVG
    // TODO find a way to do this for any SVG
    view.onClick = function(event) {
        console.log(event.point);
    }
    var circles = [];
    var fillRatio = 0.8;
    var filled = 0;
    var nTries = 5000;
    while (filled / outline.area < fillRatio && nTries > 0) {
        var c = addNewCircle(outline,circles,1,15);
        if (!c.flag) {
            console.log("circle added");
            circles.push(c);
            filled += -c.path.area; // circle is negatively parameterized
            console.log({
                outlineArea:outline.area,
                filled
            })
        }
        nTries -= 1;
    }
    console.log({nTries,filled,A:outline.area});
    
    view.draw(); // draws existing paths
}

// takes the outline a closed Path object, 
// the existing circles, an array of circle objects = {path,flag}
// rMin and rMax, numbers the minumum and maximum radius of the new circle
// attempts to find a random circle that is non overlapping with the outline or 
// any existing circles
// returns {flag: true} if attempt fails, {path, flag} if attempt is successful
addNewCircle = function(outline,circles,rMin,rMax) {
    var parent;
    if (circles.length > 0 && Math.random() > 1/circles.length) {
        console.log("circle Parent");
        parent = circles[Math.floor(Math.random()*circles.length)].path; // choose a random circle
    } else {
        parent = outline;
    }
    var t = Math.random();
    var start = parent.getPointAt(t*parent.length);
    var norm = parent.getNormalAt(t*parent.length).multiply(-1); // negative one to point inwards
    var rOutline = findRBound(outline,rMax,start,norm); // object
    var rCircs = circles.map(circ => {return findCircleBoundingRadius(circ,start,norm,rMin,rMax)});
    var minR = Math.min(rOutline.r,...rCircs);
    if (minR < 0) {
        return {flag:true};
    } else {
        var newCirc = makeCircle(start,norm.multiply(minR),"black");
        // check to see if the bounding box of the newCirc is contained by the bounding box of the 
        // outline, to prevent circles on corners slipping the cracks
        if (outline.bounds.contains(newCirc.path.bounds)) {
            return {...newCirc,flag:false};
        } else {
            newCirc.path.remove();
            return {flag:true};
        }
    }

}

// finds the max circle radius a circle starting from start with center in direction of norm
// can have before intersecting other circle circ, caps out at rMax
// returns r a number, -1 if rMin is too big to not intersect
findCircleBoundingRadius = function(circ,start,norm,rMin,rMax) {
    // TODO this function is slow
    var startToCen = circ.center.subtract(start);
    // MAKE SURE NORM IS UNIT LENGTH
    norm = norm.divide(norm.length);
    // in some cases where the normal vector is pointing away from the circle we could skip this loop
    // TODO find these cases 
    if (startToCen.length - circ.radius.length < rMin) {
        return -1; // too close to other circle
    } else {
        var dr = startToCen.length/25;
        var r = 0;
        flag = true;
        while (flag && r < rMax) { // increment r until it intersects
            var cen = start.add(norm.multiply(r));
            var newCenToEstablishedCen = cen.subtract(circ.center).length;
            var radSum = r + circ.radius.length;
            if (newCenToEstablishedCen > radSum) {
                r += dr;
            } else {
                flag = false;
            }
        }
        return r;
    }
}

// finds the maximum radius the circle at start on outline can be without intersecting the path
// more than tangentially
// returns {r: maximum radius allowed by outline, 
//          flag: boolean, whether the binary search bottomed out
//          }
findRBound = function(outline,rMax,start,norm,anim=false) {
    var circ = makeCircle(start,norm.multiply(rMax),null);

    var pTol = 0.1; // make these scale with the size of bounding box of outline?
    var nTol = 0.1;
    var tol = 0.1;
    // get intersections, filters out points that are redundant with start
    // by using how close they are to start and the normal at start
    var inter = outline.getIntersections(circ.path, loc => {
        return removeRedundant(loc,start,norm,pTol,nTol);
    });
    if (inter.length < 1) { // then rMax is small enough to fit in the outline
        return { r:rMax, flag:false };
    } else {
        // start binary search for rBound
        return binarySearch(outline,[0,rMax],start,norm,pTol,nTol,tol,0,30,anim);
    }
}

// uses a binary search algorithm to find a close approximation of what radius a circle from 
// start with direction norm towards its center could have and intersect the outline in one
// other point. pTol and nTol are used for removing redundant intersections, tol is for 
// exiting recursion and determining that intersection points are close enougth
// to be considered the same point
// returns {r: radius,
//          flag: true if recursion bottoms out}
binarySearch = function(outline,rRange,start,norm,pTol,nTol,tol,depth,maxDepth=20,anim=false) {
    var mid = (rRange[0] + rRange[1]) / 2;
    var circ = Path.Circle({
        center: start.add(norm.multiply(mid)),
        radius: mid,
        strokeColor: anim ? "yellow" : null
    });
    var inter = outline.getIntersections(circ,loc => {
        return removeRedundant(loc,start,norm,pTol,nTol);
    });
    circ.remove(); // remove from view
    if (depth > maxDepth) { // reached max depth
        return { r:mid, flag:true }; 
    } else if (inter.length > 2) { // explore small subrange
        return binarySearch(outline,[rRange[0],mid],start,norm,pTol,nTol,tol,depth+1,maxDepth,anim);
    } else if (inter.length === 2) { 
        var dif = inter[0].point.subtract(inter[1].point).length;
        if (dif < tol) { // break recursion
            return { 
                    r:mid,
                    flag:false 
                };
        } else { // explore small subrange 
            return binarySearch(outline,[rRange[0],mid],start,norm,pTol,nTol,tol,depth+1,maxDepth,anim);
        }
    } else { // explore larger subrange
        return binarySearch(outline,[mid,rRange[1]],start,norm,pTol,nTol,tol,depth+1,maxDepth,anim);
    }
}

removeRedundant = function(loc,start,norm,pTol,nTol) {
    var pDif = start.subtract(loc.point).length;
    var nDif = Math.abs(norm.angle - loc.normal.multiply(-1).angle);
    return pDif > pTol && nDif > nTol;
}

// makes a circle Path that starts from the start point with the radius vector pointing from
// start to the center. Parameterizes circle negatively
makeCircle = function(start,radius,c) {
    var radT = radius.rotate(90);
    var q1 = start.add(radius).add(radT);
    var q2 = start.add(radius.multiply(2));
    var q3 = start.add(radius).subtract(radT);
    var p = new Path.Arc(start,q1,q2);
    var p2 = new Path.Arc(q2, q3, start);
    return {path: new Path({segments:[...p.segments,...p2.segments],strokeColor:c}),
            center: start.add(radius),
            radius: radius};   
}

// draws a looping blue dot along the specified path in the specified view
animatePath = function(path,view) {
    var t = 0;
    var dot = new Path.Circle({
        center: path.getPointAt(t),
        radius: path.bounds.width / 200,
        strokeColor: "blue"
    });
    view.onFrame = function(ev) {
        t += 0.001;
        if (t >= 1) { t -= 1; }
        dot.position = path.getPointAt(t*path.length);
    }
}

wait = function(ms) {
    var start = Date.now();
    console.log("wait", ms, "ms");
    while (Date.now() - start < ms) {
    }
    console.log("Ok go");
}