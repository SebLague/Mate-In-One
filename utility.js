function squareCoordFromPoint(p) {
    let px = clamp01(p.x/(size*8));
    let py = 1-clamp01(p.y/(size*8));

    let x = clamp(Math.floor(px*8),0,7);
    let y = clamp(Math.floor(py*8),0,7);

    return new Point(x,y);
}

function indexFromCoord(coord) {
	return coord.y*8 + coord.x;
}

function posFromSquareCoord(coord) {
    return new Point((coord.x+.5) * size,(7.5-coord.y)*size);
}

function pointToAlgebraic(point) {
	return "abcdefgh"[point.x] + "" + (point.y+1);
}

function coordFromAlgebraic(algebraic) {
	let fileIndex = "abcdefgh".indexOf(algebraic[0]);
	return new Point(fileIndex,parseInt(algebraic[1])-1);
}



function clamp(v, min, max) {
    return Math.min(Math.max(v,min),max);
}

function clamp01(v) {
    return clamp(v,0,1);
}

function GetURLParameter(sParam)
{
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) 
    {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) 
        {
            return sParameterName[1];
        }
    }
}
