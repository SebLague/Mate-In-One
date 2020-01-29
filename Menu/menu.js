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


const modeDescriptions = [
	"untimed, just solve puzzles",
	"solve as many puzzles as you can before the time runs out",
	"solve each puzzle before time runs out to reset the timer"
];

// Appearance:
const defaultButtonCol = 0x222222;
const selectedCol = 0xff5959;
const disabledCol = 0x444444;

let sectionSpacing = 80;//
let headerSpacing = 50;
let headerXAdjust = -20;
let buttonSpacing = 15;
let border = 100;

const headingStyle = new PIXI.TextStyle({
    fill: "#bcbcbc",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 30,
    fontWeight: "bold",
	strokeThickness: 0
});

const buttonTextStyle = new PIXI.TextStyle({
    fill: "#FFFFFF",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 25,
    fontWeight: "bold",
	strokeThickness: 0
});

const descriptionTextStyle = new PIXI.TextStyle({
    fill: "#777777",
    fontFamily: "\"Lucida Console\", Monaco, monospace",
    fontSize: 15,
    fontWeight: "bold",
	strokeThickness: 0
});

// System
var countdownModeStartTimeValue = 60;
var streakModeStartTimeValue = 10;

var modeIndex = 0;
var puzzleSetIndex = 0;
var timeSection;
var modeButtons;
var puzzleSetButtons;

PIXI.loader.load(setup);

function setup() {

    menuContainer = new PIXI.Container();

	yPos = border*.75;
	
	createModeSection();
	createTimeSection();
	createOtherSettingsSection();
	createBeginButton();
	
	
	displayTimeSection(false);//
	updateTimerText();

	
	app.stage.addChild(menuContainer);
   
	window.addEventListener('resize', resize);
	resize();
}

function createHeader(text, yPos) {
	let container = new PIXI.Container();
	let header = new PIXI.Text(text, headingStyle);
	header.position.set(border+headerXAdjust,yPos);
	container.addChild(header);
	menuContainer.addChild(container);
	return container;
}

function createButtonGroup(buttonIndex,buttonArray, y,text) {
	let x = border;
	if (buttonIndex > 0) {
		x = buttonArray[buttonIndex-1].position.x + buttonArray[buttonIndex-1].width + buttonSpacing;
	}
	
	let buttonContainer = createButton(text,x,y);

	buttonContainer.on("pointerdown", () => selectButton(buttonArray,buttonIndex));
	return buttonContainer;
	
}

function createButton(text,x,y,buttonCol = defaultButtonCol) {
	let buttonGrowX = 15;//
	let buttonGrowY = 6;
	
	let graphics = new PIXI.Graphics();
	let buttonContainer = new PIXI.Container();
	buttonContainer.addChild(graphics);
	buttonContainer.interactive = true;
	
	let t = new PIXI.Text(text,buttonTextStyle);
	t.tint = disabledCol;
	//t.position.set(x,y);//
	graphics.beginFill(buttonCol);
	graphics.drawRect(-buttonGrowX,-buttonGrowY,t.width+ buttonGrowX*2,t.height+buttonGrowY*2);
	
	buttonContainer.addChild(t);
	buttonContainer.position.set(x,y);
	menuContainer.addChild(buttonContainer);
	
	return buttonContainer;
}

function resize() {
	let inset = 20;//
	
	let w = window.innerWidth-inset;
	let h = window.innerHeight-inset;
	
	app.renderer.resize(w,h);
	let minDim = Math.min(w,h);

	let scale = (minDim)/nativeSize;
	menuContainer.scale.set(scale);
	//let dstToTopEdge = (h-menuContainer.height)/2;
	menuContainer.position.set(0,0);
	
}

function selectButton(buttonArray,buttonIndex) {
	for (let i = 0; i < buttonArray.length; i++) {
		buttonArray[i].children[1].tint = disabledCol;
	}
	buttonArray[buttonIndex].children[1].tint = selectedCol;
	
	if (buttonArray == modeButtons) {
		if (modeIndex != 0 && buttonIndex == 0) {
			displayTimeSection(false);
		}
		else if (modeIndex == 0 && buttonIndex != 0) {
			displayTimeSection(true);
		}
		
		modeIndex = buttonIndex;
		modeDescriptionText.text = modeDescriptions[modeIndex];
		updateTimerText();
	}
	else if (buttonArray == puzzleSetButtons) {
		puzzleIndex = buttonIndex;
	}
	
}

function createPuzzleSetSection() {
	createHeader("Puzzle set:", yPos);
	yPos += headerSpacing;
	
	puzzleSetButtons = new Array(2);
	puzzleSetButtons[0] = createButtonGroup(0, puzzleSetButtons, yPos,"Mate in one");
	puzzleSetButtons[1] = createButtonGroup(1, puzzleSetButtons, yPos,"Mate in two");
	selectButton(puzzleSetButtons,0);
	yPos += sectionSpacing;
}

function createModeSection() {
	createHeader("Mode:", yPos);
	yPos += headerSpacing;
	
	modeButtons = new Array(3);
	modeButtons[0] = createButtonGroup(0, modeButtons, yPos,"Endless");
	modeButtons[1] = createButtonGroup(1, modeButtons, yPos,"Countdown");
	modeButtons[2] = createButtonGroup(2, modeButtons, yPos,"Streak");
	modeDescriptionText = new PIXI.Text("description text", descriptionTextStyle);
	modeDescriptionText.position.set(modeButtons[0].position.x, modeButtons[0].y + 50)
	menuContainer.addChild(modeDescriptionText);
	selectButton(modeButtons,0);
	yPos += modeDescriptionText.height + sectionSpacing;
}

function createTimeSection() {
	timeSection = new PIXI.Container();
	let timeHeader = createHeader("Time:", yPos);
	yPos += headerSpacing;
	
	let minus10 = createButton("-10",border,yPos);
	let minus5 = createButton("-5", minus10.position.x + minus10.width + buttonSpacing, yPos);
	
	let timeDisplay = createButton("180 seconds", minus5.position.x + minus5.width + buttonSpacing, yPos, app.renderer.backgroundColor);
	timeDisplay.children[1].tint = 0x777777;
	
	let plus5 = createButton("+5",timeDisplay.position.x+timeDisplay.width+buttonSpacing,yPos);
	let plus10 = createButton("+10", plus5.position.x + plus5.width + buttonSpacing, yPos);//
	
	// events
	minus10.on('pointerdown',()=>addTime(minus10.children[1],-10));
	minus10.on('pointerup',()=>minus10.children[1].tint = disabledCol);
	
	minus5.on('pointerdown',()=>addTime(minus5.children[1],-5));
	minus5.on('pointerup',()=>minus5.children[1].tint = disabledCol);
	
	plus5.on('pointerdown',()=>addTime(plus5.children[1],5));
	plus5.on('pointerup',()=>plus5.children[1].tint = disabledCol);
	
	plus10.on('pointerdown',()=>addTime(plus10.children[1],10));
	plus10.on('pointerup',()=>plus10.children[1].tint = disabledCol);
	
	timeSection.addChild(timeDisplay);
	timeSection.addChild(minus10);
	timeSection.addChild(minus5);
	
	timeSection.addChild(plus5);
	timeSection.addChild(plus10);
	timeSection.addChild(timeHeader);
	menuContainer.addChild(timeSection);
	
	yPos += sectionSpacing;
}

function createOtherSettingsSection() {
	//createHeader("Other:", yPos);
}

function createBeginButton() {
	let buttonContainer = createButton("Begin",border,yPos + 25);
	let beginButtonCol = 0xffffff;
	buttonContainer.children[1].tint = beginButtonCol;
	buttonContainer.on("pointerdown", loadpuzzles);
	buttonContainer.on("pointerdown", () => buttonContainer.children[1].tint = selectedCol);
	buttonContainer.on("pointerup", () => buttonContainer.children[1].tint = beginButtonCol);
}

function displayTimeSection(visible) {
	if (timeSection != null && timeSection != undefined) {
		if (visible) {
			timeSection.alpha = 1;
			//menuContainer.addChild(timeSection);
		}
		else {
			timeSection.alpha = .15;
			//menuContainer.removeChild(timeSection);
		}
	}
}

function updateTimerText() {
	if (timeSection != null && timeSection != undefined) {
		var seconds = 0;
		if (modeIndex == 1) {
			seconds = countdownModeStartTimeValue;
		}
		else if (modeIndex == 2) {
			seconds = streakModeStartTimeValue;
		}
		
		timeSection.children[0].children[1].text = seconds + " seconds";
	}
}

function addTime(text, seconds) {
	if (modeIndex != 0) {
		text.tint = selectedCol;
		if (modeIndex == 1) {
			countdownModeStartTimeValue += seconds;
			countdownModeStartTimeValue = Math.max(5,Math.min(countdownModeStartTimeValue,900));
		}
		else if (modeIndex ==2) {
			streakModeStartTimeValue += seconds;
			streakModeStartTimeValue = Math.max(5,Math.min(streakModeStartTimeValue,900));
		}

		updateTimerText();
	}
}

function loadpuzzles() {
	
	let params = "?";
	if (modeIndex == 0)
		params +="timed=false";
	else if (modeIndex == 1)
		params +="timed=true&startTime=" + countdownModeStartTimeValue + "&suddenDeath=true";
	else if (modeIndex == 2)
		params +="timed=true&resetTimerOnSolve=true&startTime=" + streakModeStartTimeValue + "&suddenDeath=true";
	
	//let url = "http://www.sebastianlague.site/chess/mate-trainer/" + params;
	let url = "https://seblague.github.io/Mate-In-One/" + params;
	console.log(url);
	window.open(url,"_self");
}


