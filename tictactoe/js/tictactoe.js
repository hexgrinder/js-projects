(function ($,undefined) {

var 
INIT = function(selector) {

	function select(func) {
		return function(opts) {
			if (!document.getElementById(this._select))
				throw Error("Cannot find element id '" + this._select + "'");
			// TODO: ACCOMODATE FOR HTML ELEMENTS -> SEND IT.
			return func(document.getElementById(this._select), opts || {});
		};
	};

	var
	init = function(id){
		this['_select'] = id;
	};
	init.prototype = {
		addEventListener : select(function(elem, opts) {
			if (opts.events) {
				for (var n in opts.events) {
					elem.addEventListener(n, opts.events[n]);
				}
			}
			return _self;
		}),
		addMenuBar: select(function(elem,opts) {
			
			var
			frag = document.createDocumentFragment(),
			ul = document.createElement('ul');
			
			frag.appendChild(ul);
			
			if (opts['class'])
				ul.classList.add(opts['class']);
			
			if (opts.controls) {
				var li;
				for (var i = 0, len = opts.controls.length; i < len; i++) {
					li = document.createElement('li');
					li.textContent = opts.controls[i].text || ('item ' + i);
					if (opts.controls[i].events) {
						for (var n in opts.controls[i].events) {
							li.addEventListener(n, opts.controls[i].events[n]);
						}
					}
					ul.appendChild(li);
				}
				li = null;
			}
			
			var
			display = elem.style.display;
			// disappear elem to avoid redrawing the 
			// entire tree when append happens
			elem.style.display = 'none';
			elem.appendChild(frag);
			// restore display
			elem.style.display = display;
			
			// clean up
			frag = ul = null;
			
			return _self;
		})
	};
	
	var
	_self = new init(selector);
	
	return _self;
	
}; // INIT


var
logic = function() {
	var
	/*
	Index Mappings
	 0 | 1 | 2
	----------- 
	 3 | 4 | 5
	----------- 
	 6 | 7 | 8
	*/
	winPatterns = 
		[ 0x007, 0x038, 0x1c0, // horizontal
		  0x049, 0x092, 0x124, // vertical
		  0x111, 0x054 ],      // diagonals
	tests = {
		/**
		Check for valid move.
		*/
		valid : function (params) {
			var 
			board = params.board,
			index = params.index;
			if (index < 0 || index >= board.length)
				return false;
			else
				return board[index] == -1; 
		},
		/**
		Check for winning move.
		*/
		win : function(params, winPatterns) {
			var
			board = params.board,
			statePattern = 0x0;
			// translate array into pattern
			for (var i = 0, len = board.length; i < len; i++) {
				if (board[i] == params.currPlayer.id) {
					statePattern |= (0x1 << i);
				}
			}
			// check against winning patterns
			for (var i = 0, len = winPatterns.length; i < len; i++) {
				if (!((winPatterns[i] & statePattern) ^ winPatterns[i])) {
					return true;
				}
			}
			return false;
		},
		/**
		Check for end of game draw.
		*/
		draw : function(params) {
			var b = params.board; 
			for (var i = 0, len = b.length; i < len; i++) {
				if (b[i] == -1) 
					return false;
			}
			return true;
		}
	},
	listeners = {
		valid:[],
		draw:[],
		win: [],
		invalid:[],
		next:[]
	};

	/**
	Constructs a notify function for event response.
	The notify function encapsulates game logic and notifies
	the appropriate game-state event listener.
	
	@return Returns a notify function.
	*/
	function _reactor(winPatterns, tests, listeners) {
		
		// helper function
		function notifyAll(listeners) {
			return function(state) {
				for (var i = 0, len = listeners.length; i < len; i++) {
					listeners[i](state);
				};
			}
		}
		
		var
		notifyWin = notifyAll(listeners.win),
		notifyDraw = notifyAll(listeners.draw),
		notifyNext = notifyAll(listeners.next),
		notifyInvalid = notifyAll(listeners.invalid);
		notifyValid = notifyAll(listeners.valid);
		
		// notify function
		return function(state) {
			
			// catch existing win or draw states
			if (tests.win(state, winPatterns) || tests.draw(state)) {
				return;
			}
			
			if (tests.valid(state)) {
				
				notifyValid(state);
				
				if (tests.win(state, winPatterns)) {
					notifyWin(state);
					return;
				}
				if (tests.draw(state)) {
					notifyDraw(state);
					return;
				}
				
				notifyNext(state);
			} else {
				notifyInvalid(state);
			}
		};
	}
	
	function _registerListeners(listeners) {
		// this is the register handler
		return function (name, cb) {
			// TODO: SINGLETON AND ARRAYAS ACCOMODATIONS
			if (listeners.hasOwnProperty(name))
				listeners[name].push(cb);
			return this;
		};
	}

	this['notify'] = _reactor(winPatterns, tests, listeners);
	this['addStateListener'] = _registerListeners(listeners);
	
}; // logic

var
waves = {
	sine : function(T) {
		var waveNum = 2 * Math.PI / T;
		return function(x) {
			return Math.sin(waveNum * x);
		};
	}
}; // waves

var
imageLoader = function(opt) {
	
	opt = opt || {};
	
	/**
	@return Returns a draw function constructor
	*/
	function createTileFactory(imgpath, typename, opts) {
		
		opts = opts || {};
		
		var
		img = new Image();
		
		img.src = imgpath;
		
		var
		type = {
			// TODO: HOW TO DRAW A PATTERN FROM A TILE IN A TILESET???
			/*
			// THIS FUNCTION WILL HAVE TO ACCOMODATE FOR A SINGLE SOURCE IMAGE
			// IF CONVERTING TO A TILESET FACTORY
			// have to draw on a canvas
			// getImageData(sx,sy,sw,sh)
			// putImageData(imgdata,dx,dy,[dirx],[diry],[dirw],[dirh])
			*/
			'pattern' : function(loc) {
				
				var pattern;
				
				// this ensures that the image is loaded BEFORE 
				// creating a pattern, otherwise a resource NA error.				
				img.addEventListener('load', function() {
					pattern = document
						.getElementById(opts.canvasId)
						.getContext('2d')
						.createPattern(img, opts.layout || 'repeat');
				}, false);
				
				return function(ctx) {
					var
					cvs = ctx.canvas;
					ctx.save();
					ctx.fillStyle = pattern || 'white'; 
					ctx.fillRect(0,0,cvs.width,cvs.height);
					ctx.restore();
					cvs = null;
				};
			},
			'static' : function(loc) {
				return function(ctx, dx, dy, dw, dh) {
					ctx.drawImage(
						img, 
						loc.x, loc.y, loc.w, loc.h, 
						dx, dy, dw, dh);
				};
			},
			'animate' : function() {
				return function(ctx, sx, sy, sw, sh, dx, dy, dw, dh) {
					ctx.drawImage(
						img, 
						sx, sy, sw, sh, 
						dx, dy, dw, dh);
				};
			}
		};
		
		// if typenames do not match, no drawing will occur.
		return (type.hasOwnProperty(typename)) ? type[typename] : function(){return function(){}}; 
	}
	
	var
	_tilefactory = createTileFactory('img/crayonPieces_64.png', 'static');
	_backgroundfactory = createTileFactory('img/paper_collegeLine_32x32.png', 'pattern', opt);
	_linefactory = createTileFactory('img/crayonLine_512x64.png', 'static');

	// TODO?: HOW TO PATTERN A TILE IN A TILESET???
	
	return {
		player1: _tilefactory({ x:384, y:0, w:64, h:64 }),
		player2: _tilefactory({ x:448, y:0, w:64, h:64 }),
		background: _backgroundfactory(),
		divider : _linefactory({ x:0, y:0, w:512, h:64 })
	};
};


/*
boardSetup c'tor
*/
function boardSetup(gameLogic, gameOpts) {
	
	this['_logic'] = gameLogic;
	
	var 
	_self = this;
	
	/*
	function tileDrawFactory(imgpath) {
		
		var
		img = new Image();
		img.src = imgpath;
		
		// loc defines tile set
		// typename defines what type of drawing function is returned
		// [opts] additional options
		return function(loc, typename, opts) {
			var 
			type = { 
				// constructor types... 
			};
			return type[typename];
		};
		
	}
	*/
	
	var
	images = imageLoader(gameOpts);
	
	this.player[1].img = images.player1;
	this.player[2].img = images.player2;
	this._backgrnd = images.background;
	this._divider = images.divider;
	
	images = null;
	
	//
	// Helper Functions
	//
	
	function composeDrawFunc2s(f1,f2) {
		return function(ctx,opts) {
			f1(ctx,opts);
			f2(ctx,opts);
		}
	}
	
	//
	// GRID LINES SETUP
	//
	
	function composeDrawHorzDivider(display, divider) {

		var
		dividerLength = display.dividerLength,
		dividerHeight = display.dividerHeight,
		spacing = display.cellHeight + dividerHeight,
		adjX = margin + dividerLength/2;
		
		return function(ctx, opts) {
			
			ctx.save();
			
			ctx.translate(adjX, 0);
			for (var i = 0, len = display.numDividers; i < len; i++) { 
				ctx.translate(0, spacing);
				divider(ctx, dividerLength, dividerHeight);
			}
			
			ctx.restore();
		};
	}
	
	function composeDrawVertDivider(display, divider) {
		
		var
		dividerLength = display.dividerLength,
		dividerHeight = display.dividerHeight,
		spacing = -(display.cellWidth + dividerHeight),
		adj = display.margin;
		
		return function(ctx, opts) {
			
			ctx.save();
			
			ctx.translate(adj, adj);
			ctx.rotate(Math.PI/2);
			ctx.translate(dividerLength/2, dividerHeight/2);
			for (var i = 0, len = display.numDividers; i < len; i++) { 
				ctx.translate(0, spacing);
				divider(ctx, dividerLength, dividerHeight);
			}
			
			ctx.restore();
		};
	}
	
	function divider(ctx, length, height) {
		_self._divider(ctx, -length/2, -height/2, length, height);
	}

	//
	// DRAW WORDS SETUP
	//
	
	function composeDrawWords(opt) {
	
		var
		dim = opt.dim,
		margin = opt.margin,
		sw = opt.dividerHeight,
		L1 = opt.cellWidth,
		L2 = opt.cellHeight,
		board = opt.board,
		words = opt.words,
		
		// TODO: PULL THE SETTINGS OUT// THIS IS TOO DEEP TO HANDLE
		color = (opt.color) ? opt.color : 'black';
		font = (opt.font) ? opt.font : '25px pencil'; //'20px palatino';
		
		txtAlignX = margin+L1/2, 
		txtAlignY = margin+L2/2,
		vertAlign = L1+sw,
		horzAlign = L2+sw;
	
		return function(ctx, opts) {
			
			ctx.save();
			
			ctx.fillStyle = color;
			ctx.font = font;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
		
			var 
			adjX = 0, 
			adjY = 0, 
			occupyingPlayer = null;
			
			for (var i = 0, len = board.length; i < len; i++) {
				
				// if undefined, then no player occupies cell
				occupyingPlayer = _self.player[board[i]];
				// cell-by-cell alignments
				adjX = (i%dim)*vertAlign,
				adjY = (Math.floor(i/dim))*horzAlign;
				
				// words
				if (words[i]) {
					ctx.save();
						if (occupyingPlayer) {
							ctx.fillStyle = 'silver';
						}
						ctx.fillText(
							words[i],
							adjX+txtAlignX,
							adjY+txtAlignY);
					ctx.restore();
				}
			}
			
			ctx.restore();
		};
	}

	//
	// DRAW TILES SETUP
	//
	
	function composeDrawTiles(opt) {
		
		var
		dim = opt.dim,
		margin = opt.margin,
		sw = opt.dividerHeight,
		L1 = opt.cellWidth,
		L2 = opt.cellHeight,
		board = opt.board,
		
		vertAlign = L1+sw,
		horzAlign = L2+sw;
	
		return function(ctx, opts) {
			var 
			occupyingPlayer = null
			adjX = 0,
			adjY = 0;
			
			for (var i = 0, len = board.length; i < len; i++) {
				
				occupyingPlayer = _self.player[board[i]];
				
				if (!occupyingPlayer)
					continue;
				
				adjX = (i%dim)*vertAlign,
				adjY = (Math.floor(i/dim))*horzAlign;
			
				occupyingPlayer.img(
					ctx, 
					adjX+margin, 
					adjY+margin, 
					L1,L2);
			}
		};
	}
	
	//
	// DRAWING THE BOARD
	//
	
	function composeDrawBoard(grid, words, tiles) {
		return function(ctx, opts) {
			// draw in the following order...
			grid(ctx, opts);
			words(ctx, opts);
			tiles(ctx, opts);
		};
	}
	
	function render(draw) {
		return function(opts) {
			var
			ctx = document
				.getElementById(gameOpts.canvasId)
				.getContext('2d');
				
			ctx.save();
			draw(ctx, opts || {});
			ctx.restore();
			
			ctx = null;
		};
	}
	
	//
	// UPDATE SETUP
	//
	
	function registerMove(event, state) {
		var
		dim = _self.dim,
		canvas = event.target,
		offset = _self.display.boarderWidth/2,
		// todo: alternative to floor???
		ix = Math.max(Math.floor(((event.layerX - canvas.offsetLeft) - offset) / (canvas.width/dim)),0),
		iy = Math.max(Math.floor(((event.layerY - canvas.offsetTop) - offset) / (canvas.height/dim)),0),
		//ix = Math.floor(((event.pageX - canvas.offsetLeft) - offset) / (canvas.width/dim)),
		//iy = Math.floor(((event.pageY - canvas.offsetTop) - offset) / (canvas.height/dim)),
		index = ix + iy * dim;
		
		//console.log(event);
		//console.log(ix + " : " + iy);
		canvas = null;
		
		// process move
		return _self._logic.notify({
			dim : dim,
			board : _self.board,
			index : index,
			currPlayer : state.currPlayer
		});
	}
	
	//
	// EFFECTS
	//
	
	/*
	function animate(name, opts) {
	
		var
		animations = {
			shake : render(
				effects.driver(
					drawBackground(
						effects.shake(drawing)))),
			switcheroo : effects.switcheroo()
		};
		
		return animations[name](opts);
	}
	*/
	
	var
	animate = {
		driver : function(draw, opt) {
		
			opt = opt || {};
			
			var
			step = opt.step || .01,
			duration = opt.duration || 25,
			interval = opt.interval || 20;
			
			return function (ctx,opts) {
				
				var 
				time = 0,
				ticks = duration,
				driver = window.setInterval(function() {
					opts['elapsedPercentage'] = time;
					if (ticks-- <= 0) {
						opts['elapsedPercentage'] = 0;
						ctx.clearRect(
							0, 0, 
							ctx.canvas.width, ctx.canvas.height);
						draw(ctx, opts);
						window.clearInterval(driver);
						driver = null;
					} else {
						draw(ctx,opts);
					}
					time += step;
				}, interval);
			};
		},
		shake : function(draw) {
			var
			effect = waves.sine(.1);
			return function (ctx,opts) {
				ctx.save();
				ctx.translate(5*effect(opts.elapsedPercentage),0);
				draw(ctx,opts);
				ctx.restore();
			};
		},
		switcheroo : function() {
			var
			board = _self.board,
			words = _self.words;
			return function() {
				
				var list = [];
				
				// scan for open boxes
				for (var i = 0, len = board.length; i < len; i++) {
					// skip occupied skills
					if (board[i] != -1)
						continue;
					list.push(i);
				}
				
				// if only 1, stop
				if (list.length <= 1)
					return;
				
				// switching loop 
				var
				si = 0,
				o = 0, 
				temp;
				for (var j = 0, len = list.length, maxIndex = len-1; j < len; j++) {
					si = Math.min(Math.round(Math.random()*10),maxIndex)
					o = list[j];
					temp = words[o];
					words[o] = words[list[si]];
					words[list[si]] = temp;
					temp = null;
				}
			}
		}
	};
	
	// Config
	
	var
	dim = _self.dim,
	margin = _self.display.margin,
	boardWidth = _self.display.canvasWidth - 2*margin,
	boardHeight = _self.display.canvasHeight - 2*margin - _self.display.statusBarHeight,
	sw = _self.display.boarderWidth,
	
	// can be brought down into the composer as a local variable
	L1 = (boardWidth - (dim-1)*sw) / dim,	//cellWidth
	L2 = (boardHeight - (dim-1)*sw) / dim, //cellHeight
	
	cellDims = {
		dim : 3,
		margin : margin,
		dividerHeight : sw,
		cellWidth : L1,
		cellHeight : L2,
		board : _self.board,
		words : _self.words };	

	//
	// CONSTRUCTORS
	//
	
	var
	drawing = composeDrawBoard(
		composeDrawFunc2s(
			composeDrawHorzDivider({
					dividerLength : boardWidth,
					dividerHeight : sw,
					cellHeight : L2,
					cellWidth : L1,
					numDividers : 2,
					margin : margin
				},
				divider),
			composeDrawVertDivider({
					dividerLength : boardHeight,
					dividerHeight : sw,
					cellHeight : L2,
					cellWidth : L1,
					numDividers : 2,
					margin : margin
				},
				divider)), 
		composeDrawWords(cellDims), 
		composeDrawTiles(cellDims)
	);
	
	this['update'] = registerMove;
	this['draw'] = render(composeDrawFunc2s(_self._backgrnd, drawing));
	
	function composeEffects() {
		var
		effects = {
			'shake': render(
				animate.driver(
					composeDrawFunc2s(_self._backgrnd, animate.shake(drawing)))),
			'switcheroo': animate.switcheroo()
		};
		return function(name,opts) {
			return effects[name](opts);
		}
	}
	
	this['animate'] = composeEffects(); 
	
	this['loadWords'] = function(newwords) {
		
		// todo: map/reduce? reduce on same index w/max len, copy into words 
		
		// overwrite existing words
		for (var i = 0, lenA = _self.words.length, lenB = newwords.length; i < lenA && i < lenB; i++) {
			_self.words[i] = newwords[i];
		}
	
	};
	this['reset'] = function() {
		for (var i = 0, len = _self.board.length; i < len; i++)
			_self.board[i] = -1;
	};
}
boardSetup.prototype = {
	dim : 3,
	display : {
		canvasWidth : 350,
		canvasHeight : 350,
		margin : 5,
		statusBarHeight : 0,
		boarderWidth : 32,
		// crap?: is this needed?
		boarderHeight : 51
	},
	// TODO: this should come out
	player : {
		1 : {img : null},
		2 : {img : null}
	},
	/*
	Index Mappings
	 0 | 1 | 2
	----------- 
	 3 | 4 | 5
	----------- 
	 6 | 7 | 8
	*/
	board : [-1,-1,-1,
		     -1,-1,-1,
			 -1,-1,-1],
	words : [
		'fish', 'cat', 'mine', 
		'craft', 'pig', 'dog', 
		'bark', 'mail', 'back']
};

function gameState() {
	this.currPlayer = this.player[1];
}
gameState.prototype = {
	currPlayer : null,
	player : {
		1 : {id: 1},
		2 : {id: 2}
	},
	setNextPlayer : function(id) {
		// if player is null or empty string, it will convert to zero
		if (+id && this.player.hasOwnProperty(+id)) {
			this.currPlayer = this.player[+id];
			return;
		}
		this.currPlayer = (this.currPlayer.id == 1) ? this.player[2] : this.player[1];
	}	
};

var
createGame = function(opts) {

	var
	DEFAULTS = {
		wordSvcResrc: 'hahahh'
	},

	canvas = document.getElementById(opts.canvasId),
	game = new gameState(),
	smarts = new logic(),
	brd = new boardSetup(smarts, opts);
	
	smarts
		.addStateListener('draw', function () { 
			brd.draw(); 
		})
		.addStateListener('valid', function (state) { 
			brd.board[state.index] = game.currPlayer.id;
		})
		.addStateListener('invalid', function () { 
			brd.animate('shake'); 
		})
		.addStateListener('win', function () { 
			brd.draw(); 
		})
		.addStateListener('next', function () { 
			// TODO: switcheroo should be an animation that draws itself
			if (opts.switcheroo === true)
				brd.animate('switcheroo');
			brd.draw();
			game.setNextPlayer(); 
		});
	
	// TODO: Handler for updates of canvas resize
	// CRAP? : DOES THIS WORK??
	canvas.width = brd.display.canvasWidth;
	canvas.height = brd.display.canvasHeight;
	
	INIT(opts.menuId)
		.addMenuBar({
			'class': 'menu-list',
			'controls': [
			{
				'text': 'New Game',
				'events' : {
					'click': function() {
						game.setNextPlayer(1);
						brd.reset();
						brd.draw();
					}
				}
			},
			{
				'text': 'New Words',
				'events' : {
					'click': function() {
						$.get({
							// error: access to restricted URI denied.
							url: "http://localhost:8080/wordsmith/game/tictactoe",
							dataType: 'json' })
							.done(function(data) {
								console.log(data);
							})
							.fail(function(err) {
								console.log("error");
								console.log(err);
								console.log(err.statusText);
							})
							.always(function() {
								console.log("finished");
								brd.draw();
							});
						// TODO: ASSIGN TO WEB SERVICE
						/*
						brd.loadWords([
							'carp', 'bad', 'gato',
							'cantar', 'plague', 'fastidious',
							'bastion', 'bake', 'plaque'					
						]);
						brd.draw();
						*/
					}
				}
			}]
		});

	window.addEventListener('load', function() {
		brd.draw();
	});
	
	// clean up
	canvas = null;

	return function(event) {
		brd.update(event, { currPlayer : game.currPlayer });
	};
}; // createGame

function loadGame(obj) {

	var
	canvas = document.getElementById(obj.canvasId);
	
	if (!canvas) {
		canvas = null;
		throw Error("Cannot find the canvas: '" + obj.canvasId + "'.");
	} else if (!canvas.getContext) {
		canvas = null;
		throw Error("Sorry, '" + obj.canvasId + "' does not does not support the Canvas object. Cannot start the game. :(");
	}

	canvas.addEventListener('click', createGame(obj));
	
	canvas = null;
}

loadGame({ 
	canvasId:'board',
	menuId:'menu',
	switcheroo:true });

})(jQuery);
