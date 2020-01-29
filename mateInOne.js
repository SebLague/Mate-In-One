// Aliases://
var TextureCache = PIXI.utils.TextureCache;
var Point = PIXI.Point;
var nativeSize = 800;

let app = new PIXI.Application({ 
	autoResize: true,
	width: nativeSize,
	height: nativeSize, 
	antialias:true,
	resolution: 1 
});

app.renderer.backgroundColor = 0x191919;

//Add the canvas that Pixi automatically created for you to the HTML document
document.body.appendChild(app.view);

PIXI.loader.add("sprites/pieces.png").load(setup);

// Behaviour:
var useLocalFile = true;//
var blackPiecesInactive = true;
var resetTime = 750;
var blackMoveDelay = 350;
const timeWarningStartTime = 3;

// Game options:
var suddenDeath = false;
var gameIsTimed = false;
var resetTimerOnSolve = false;
var startTime = 180;//

// Appearance
var lightCol = 0xeed3ac;
var darkCol =  0xb38967;
var highlightCol_light = 0xede06f;
var highlightCol_dark = 0xceb244;
var checkmateHighlight_light = 0xed6a53;
var checkmateHighlight_dark = 0xd7543e;
var size = nativeSize/8;
var timeAlertCols = [0xffa79e,0xff6a5b,0xff3c28];
const numSolvedTextStyle = new PIXI.TextStyle({
    fill: "#ebebeb",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 30,
    fontWeight: "bold"
});
const timerTextStyle = new PIXI.TextStyle({
    fill: "#ebebeb",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 30,
    fontWeight: "bold"
});
const loadTextStyle = new PIXI.TextStyle({
    fill: "#000000",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 40,
    fontWeight: "bold",
	strokeThickness: 0
});

// Internal
var startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
var pieceOrder = "KQBNRP";
var files = "abcdefgh";


var pieceTextures;
var selectedSprite;

var activePuzzles;
var preloadedPuzzles;
var puzzleIndex = 0;
var fromPoint;
var allSprites = new Array(64);
var inputDisabled;
var holdingSprite;
var blackKingCoord;

var numSolved = 0;
var timerValue;
var timerPaused = false;
var lastUpdateTime;
var gameRunning = false;
var lastTimeWarningSecond = timeWarningStartTime;
var soundOn = true;

function setup() {
	
	// Get url params
	if (GetURLParameter('suddenDeath') == 'true') {
		suddenDeath = true;
	}
	if (GetURLParameter('timed') == 'true') {
		gameIsTimed = true;
	}
	if (GetURLParameter('resetTimerOnSolve') == 'true') {
		resetTimerOnSolve = true;
	}
	let startTimeParam = parseFloat(GetURLParameter('startTime'));
	if (!isNaN(startTimeParam)) {
		startTime = startTimeParam;
	}
	
	if (GetURLParameter('sound') == 'false') {
		soundOn = false;
	}
	
	//
	if (!gameIsTimed) {
		suddenDeath = false;
	}
	
	document.oncontextmenu = document.body.oncontextmenu = function(event) {onRightClick(event);};
	
    // Draw board
    boardContainer = new PIXI.Container();
	boardContainer.interactive = true;
	boardContainer.on('pointermove',onDrag);
	boardContainer.on('pointerdown',onPointerDownOnBoard);
	
	pieceContainer = new PIXI.Container();
	highlightContainer = new PIXI.Container();
	textContainer = new PIXI.Container();
	
	let graphics = new PIXI.Graphics();
    for	(let i = 0; i <8; i ++) {
        for	(let j = 0; j < 8; j ++){
            let col = ((i+j)%2===0)?lightCol:darkCol;
            graphics.beginFill(col);
            // draw a rectangle
            graphics.drawRect(i*size, j*size, size, size);
        }
    }
	
	app.stage.addChild(boardContainer);
    boardContainer.addChild(graphics);
	boardContainer.addChild(highlightContainer);
	//boardContainer.addChild(pieceContainer);
	app.stage.addChild(pieceContainer);
	app.stage.addChild(textContainer);
	
    // Pieces in order: King, Queen, Bishop, Knight, Rook, Pawn [White,Black]
    pieceTextures = new Array(6);
    for (let i = 0; i < 6; i ++){
        pieceTextures[i] = new Array(2);
    }

    // Draw pieces
    let spriteSize = 1000/6.0;

    for (let i = 0; i <= 1; i ++) {
        for (let j = 0; j < 6; j++) {

            let rect = new PIXI.Rectangle(spriteSize*j,spriteSize*i,spriteSize,spriteSize);
            let texture = new PIXI.Texture(TextureCache["sprites/pieces.png"],rect);
            texture.frame = rect;
            pieceTextures[j][i] = texture;
        }
    }
	
	
	// text
	numSolvedText = new PIXI.Text('solved: 0', numSolvedTextStyle);
	loadingText = new PIXI.Text('fetching puzzles...', loadTextStyle);//
	

	timerText = new PIXI.Text('', timerTextStyle);
	if (gameIsTimed) {
		timerText.text = 'Time: 0.0';
	}
	textContainer.addChild(timerText);
	
	textContainer.addChild(numSolvedText);
	textContainer.addChild(loadingText);
	
	window.addEventListener('resize', resize);
	resize();
	
	if (useLocalFile) {
		activePuzzles = fens.split('\n');
		onPuzzlesLoaded();
	}
	else {
		// OLD
		// fetch initial puzzle set;
	}
	
	
	puzzleCorrectSound = new Audio('Resources/Audio/PuzzleCorrect.mp3');
	puzzleFailedSound = new Audio('Resources/Audio/PuzzleFailed.mp3');
	moveSound = new Audio('Resources/Audio/Move.mp3');
	timeOutSound = new Audio('Resources/Audio/TimeOut.mp3');
	timeWarningSound = new Audio('Resources/Audio/TimeWarning.mp3');
	
}

function onPuzzlesLoaded() {
	if (!useLocalFile) {
		preloadPuzzles();
	}//
	loadingText.text = "";
	loadNextPuzzle();
	
	if (gameIsTimed) {
		timerValue = startTime;
	}
	
	gameRunning = true;
	lastUpdateTime = Date.now();
	app.ticker.add(() => timeLoop());
}

function validateMateInOne(fen) {
	let chess = new Chess(fen);
	if (chess.validate_fen(fen)) {
    	let moves = chess.moves();
    	for (let i = 0; i < moves.length; i ++) {
    		if (moves[i].san.includes('#')){
    			return true;
    		}
    	}
	}
	return false;
}

function preloadPuzzles() {
    fetch(puzzlesUrl).then((response) => {
		response.text().then((response) => {
		    preloadedPuzzles = response.split('<br>');
		});
	});
}


function resize() {
	let inset = 20;//
	let scalePercent = 0.9;
	
	let w = window.innerWidth-inset;
	let h = window.innerHeight-inset;
	
	app.renderer.resize(w,h);
	let minDim = Math.min(w,h);

	let scale = (minDim)/nativeSize * scalePercent;
	boardContainer.scale.set(scale);
	pieceContainer.scale.set(scale);
	let dstToTopEdge = (h-boardContainer.height)/2;
	boardContainer.position.set((w-boardContainer.width)/2,(h-boardContainer.height)/2 - dstToTopEdge*.5);
	pieceContainer.position.set(boardContainer.position.x,boardContainer.position.y);
	
	// position text
	numSolvedText.scale.set(scale);
	timerText.scale.set(scale);
	loadingText.scale.set(scale);
	
	setTextPositions();
	
	loadingText.position.set(boardContainer.position.x + boardContainer.width/2 - loadingText.width/2, boardContainer.position.y + boardContainer.height/2 - loadingText.height*1.25);//

	
}

function loadNextPuzzle() {
	if (activePuzzles != undefined && activePuzzles.length > 0) {
		var puzzleIndex = Math.floor(Math.random() * activePuzzles.length);
		let myFen = activePuzzles[puzzleIndex].split(',')[1];

		// double check that given position is mate in one, as there are currently some errors with puzzle generator where en-passant is involved.
		if (validateMateInOne(myFen)) {
			
			setBoardFromFen(myFen);
			chess = new Chess(myFen);
			
			if (gameRunning) {
				inputDisabled = false;
				if (resetTimerOnSolve) {
					timerValue = startTime;
				}
				timerPaused = false;
			}
		}
		else {
			loadNextPuzzle();
		}
	}
	else {
		console.log("No puzzles loaded")
	}
}



function setBoardFromFen(fen) {
	clearHighlights();
	clearBoard();
	
    let boardLayout = fen.split(' ')[0];
    let rankLayouts = boardLayout.split('/');

    for	(let rankIndex = 0; rankIndex < rankLayouts.length; rankIndex ++) {
        let fileIndex = 0;
        for (let j = 0; j < rankLayouts[rankIndex].length; j ++) {
            let char = rankLayouts[rankIndex][j];
            let num = parseFloat(char);
            if (!isNaN(num) && isFinite(num)) {
                fileIndex +=Number(parseFloat(char));
            }
            else {
                let colourIndex = (char.toUpperCase() == char)?0:1; // 0 = white, 1 = black
				let isWhite = colourIndex == 0;
                let pieceIndex = pieceOrder.indexOf(char.toUpperCase());
                let texture = pieceTextures[pieceIndex][colourIndex];
                let sprite = new PIXI.Sprite(texture);
				let pos = new Point(fileIndex*size+size*.5,rankIndex*size+size*.5);
				let coord = squareCoordFromPoint(pos);
				
                initPieceSprite(sprite, pos,size,isWhite);
                fileIndex+=1;
            	
				if (char == 'k') {
					blackKingCoord = coord;
				}
			}

        }
    }
}

function initPieceSprite(sprite, point, size, isWhite){
	
    sprite.position.set(point.x, point.y);
    sprite.width = size;
    sprite.height = size;
    sprite.anchor.set(.5);

	if (isWhite || !blackPiecesInactive){
		sprite.interactive = true;
		sprite.buttonMode = true;

		sprite.on('pointerdown', () => onPieceSelected(sprite));
		sprite.on('pointerup', onPieceReleased);
	}
    pieceContainer.addChild(sprite);
	
	let squareIndex = indexFromCoord(squareCoordFromPoint(point));
	allSprites[squareIndex] = sprite;
}


function onPieceSelected(sprite) {
	if (inputDisabled){
		return;
	}
	
	selectedSprite = sprite;
	holdingSprite = true;
	fromPoint = squareCoordFromPoint(selectedSprite.position);
	clearHighlights();
	highlightSquare(fromPoint, highlightCol_light, highlightCol_dark);
	
	//display piece on top of all other pieces
	pieceContainer.removeChild(sprite);
	pieceContainer.addChild(sprite);
	
}

function onPieceReleased() {
	if (selectedSprite == null || inputDisabled) {
		return;
	}
	
    let toPoint = squareCoordFromPoint(selectedSprite.position);
	tryMakeMove(fromPoint,toPoint);
}

function tryMakeMove(fromCoord, toCoord) {
	let proposedMove = pointToAlgebraic(fromCoord) +'-' + pointToAlgebraic(toCoord);
	
	let moveIsLegal = false;
	let legalMoves = chess.moves();
	let legalMove = null;
	
	for (let i = 0; i < legalMoves.length; i ++) {
		let legalMoveFomatted = legalMoves[i].from + '-' + legalMoves[i].to;
		if (legalMoveFomatted == proposedMove) {
			// if pawn promotion, then multiple moves will match proposed move coords
			// autopromote to knight if that is check
			moveIsLegal = true;
			legalMove = legalMoves[i];
			chess.move(legalMoves[i]);
			let moveIsCheck = chess.in_check();
			chess.undo();
			
			if (moveIsCheck) {
				break;
			}
		}
	}
	
	if (moveIsLegal) {
		chess.move(legalMove);
		lastTimeWarningSecond = timeWarningStartTime;
		let toIndex = indexFromCoord(toCoord);
		if (allSprites[toIndex] != null) {
			allSprites[toIndex].visible = false;
			allSprites[indexFromCoord(fromPoint)] = null;
			allSprites[toIndex] = selectedSprite;
		}
		setBoardFromFen(chess.fen());
		
		inputDisabled = true;
		// Puzzle solved: load next
		if (chess.in_checkmate()) {
			onPuzzleCorrect();
		}
		// Puzzle failed: show black response and then reload
		else {
			onPuzzleFailed();
		}

		highlightSquare(fromCoord, highlightCol_light, highlightCol_dark);
		highlightSquare(toCoord, highlightCol_light, highlightCol_dark);
	}
	else {
		let pos = posFromSquareCoord(fromCoord);
		selectedSprite.position.set(pos.x,pos.y);
	}
	
	if (indexFromCoord(toCoord) != indexFromCoord(fromCoord)) {
		if (!moveIsLegal) {
	    	clearHighlights();
		}
	}

	holdingSprite = false;
}

function clearHighlights() {
	for (let i = highlightContainer.children.length-1; i >=0; i --){
		highlightContainer.children[i].destroy();
	}
}

function highlightSquare(coord, lightHighlight, darkHighlight) {
	let graphics = new PIXI.Graphics();
	let col = ((coord.x +(7-coord.y)) %2==0)?lightHighlight:darkHighlight;
	graphics.beginFill(col);
	graphics.drawRect(coord.x*size, (7-coord.y)*size, size, size);
	highlightContainer.addChild(graphics);
}

function makeLegalMoveAndReset() {
	clearHighlights();
	let moves = chess.moves();
	
	// choose move which captures piece of highest value (random if no captures available)
	if (moves.length > 0){
		let bestMove = moves[0];
		let bestScore = -1;
		let captureOrder = 'pnbrq';
		
		for (let i = 0; i < moves.length; i ++) {
			let moveScore = 0;
			if (moves[i].san.includes('#')) {
				bestMove = moves[i];
				break;
			}
			if (moves[i].captured != undefined) {
				moveScore = captureOrder.indexOf(moves[i].captured);
				if (moveScore > bestScore) {
					bestScore = moveScore;
					bestMove = moves[i];
				}
			}
		}
		
		chess.move(bestMove);
		playSound(moveSound);

		setBoardFromFen(chess.fen());
		highlightSquare(coordFromAlgebraic(bestMove.from), highlightCol_light, highlightCol_dark);
		highlightSquare(coordFromAlgebraic(bestMove.to), highlightCol_light, highlightCol_dark);
	}
	
	if (!suddenDeath) {
		setTimeout(function(){loadPuzzle(puzzleIndex)},resetTime);
	}
	
}

function onDrag(e){
	if (selectedSprite != null && holdingSprite) { 
		let p = e.data.getLocalPosition(boardContainer);
 		selectedSprite.position.set(p.x,p.y);
	}
}

function onRightClick(event) {
	event.preventDefault();
	if (selectedSprite != null) {
		let pos = posFromSquareCoord(fromPoint);
		selectedSprite.position.set(pos.x,pos.y);
	
    	selectedSprite = null;
		clearHighlights();
	}
}

function onPointerDownOnBoard(e) {
	if (!inputDisabled) {
		let pressedCoord = squareCoordFromPoint(e.data.getLocalPosition(boardContainer));

		if (selectedSprite != null && indexFromCoord(fromPoint) != indexFromCoord(pressedCoord)) {
			tryMakeMove(fromPoint, pressedCoord);
		}
	}
}

function timeLoop() {
	var now = Date.now();
	var dt = now - lastUpdateTime;
	lastUpdateTime = now;
	
	if (gameRunning) {
		if (gameIsTimed && !timerPaused) {
			timerValue -= dt*.001;
			timerValue = Math.max(0,timerValue);
			let formattedTimeVal = parseFloat(Math.round(timerValue * 100) / 100).toFixed(1);
			timerText.text = "Time: " + formattedTimeVal;
			
			if (Math.floor(timerValue) < lastTimeWarningSecond) {
				timerText.style.fill = timeAlertCols[timeWarningStartTime-Math.floor(timerValue)-1];
				lastTimeWarningSecond = Math.floor(timerValue);
				
				playSound(timeWarningSound);
			}

			if (timerValue === 0) {
				playSound(timeOutSound);
				gameOver();
			}

			setTextPositions();
		}
	}
}

function onPuzzleCorrect() {
	playSound(puzzleCorrectSound);

	timerText.style.fill = numSolvedTextStyle.fill;
	
	numSolved++;
	numSolvedText.text = 'solved: ' +numSolved;
	highlightSquare(blackKingCoord, checkmateHighlight_light, checkmateHighlight_dark);
	setTimeout(function(){loadNextPuzzle()},500);
	
	if (resetTimerOnSolve) {
		timerPaused = true;
	}
}

function onPuzzleFailed() {
	playSound(puzzleFailedSound);

	setTimeout(function(){makeLegalMoveAndReset()},blackMoveDelay);
	if (suddenDeath) {
		gameOver();
	}
	else {
		timerText.style.fill = numSolvedTextStyle.fill;
	}
}

function clearBoard() {
	pieceContainer.parent.removeChild(pieceContainer);
	pieceContainer = new PIXI.Container();
	app.stage.addChild(pieceContainer);
	resize();
}

function gameOver() {
	gameRunning = false;
	
	inputDisabled = true;
	clearHighlights();
	
	if (selectedSprite != null) {
		let pos = posFromSquareCoord(fromPoint);//
		selectedSprite.position.set(pos.x,pos.y);
		selectedSprite = null;
	}
	
	timerText.style.fill = timeAlertCols[timeAlertCols.length-1];
	timerText.text = "click here to play again";
	timerText.interactive = true;
	timerText.on("pointerdown", restartgame);
	setTextPositions();
}

function restartgame() {
	lastTimeWarningSecond = timeWarningStartTime;
	
	timerText.interactive = false;
	timerText.off("pointerdown");
	timerText.text = "";
	timerText.style.fill = numSolvedTextStyle.fill;
	
	timerValue = startTime;
	inputDisabled = false;
	numSolved = 0;
	numSolvedText.text = "solved: " + numSolved;
	
	
	gameRunning = true;
	loadNextPuzzle();
}

function setTextPositions() {
	let boardEdgeBottom = boardContainer.position.y + boardContainer.height;
	let posY = boardEdgeBottom + numSolvedText.height * .5;
	
	if (gameIsTimed) {
		let boardEdgeLeft = boardContainer.position.x;
		timerText.position.set(boardEdgeLeft+boardContainer.width*.25-timerText.width/2, posY);
		numSolvedText.position.set(boardEdgeLeft+boardContainer.width*.75-numSolvedText.width/2, posY);
	}
	else {
		numSolvedText.position.set(boardContainer.position.x + boardContainer.width/2 - numSolvedText.width/2, posY);
	}
}

function playSound(sound) {
	if (soundOn) {
		sound.play();
	}
}
