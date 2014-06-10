(function(){  

    xtag.register('widget-DAQ', {
        extends: 'div',
        lifecycle: {
            created: function() {
                var xString, option, title, deckWrap;

                this.width = this.offsetWidth;
                this.height = window.innerHeight*0.6;
                this.showing = 0;

                //get the DAQ structure
                XHR('http://' + this.MIDAS + '/?cmd=jcopy&odb=/DAQ&encoding=json-nokeys', 
                    function(res){
                        this.buildDAQ(res);
                    }.bind(this), 
                    'application/json');

                //build DOM
                this.navBlock = document.createElement('div');
                this.navBlock.setAttribute('class', 'DAQnav');
                this.appendChild(this.navBlock);

                title = document.createElement('h1');
                title.innerHTML = 'DAQ';
                this.navBlock.appendChild(title);

                this.cardNav = document.createElement('select');
                this.cardNav.setAttribute('id', 'DAQnav')
                this.cardNav.setAttribute('class', 'stdin');
                this.cardNav.onchange = function(){
                    var targetIndex = parseInt(selected('DAQnav'), 10);
                    document.getElementById('DAQdeck').shuffleTo(targetIndex);
                    this.writeCollectorTooltip(-1);
                    this.showing = targetIndex;
                }.bind(this)
                this.navBlock.appendChild(this.cardNav);

                option = document.createElement('option');
                option.value = 0;
                option.innerHTML = 'Master'
                this.cardNav.appendChild(option);                

                deckWrap = document.createElement('div');
                this.appendChild(deckWrap);

                xString = '<x-deck id="DAQdeck" selected-index=0>';
                xString += '<x-card id="DAQmasterCard"></x-card></x-deck>';
                xtag.innerHTML(deckWrap, xString);
                this.nCards = 1

                this.masterBlock = document.createElement('div');
                this.masterBlock.setAttribute('class', 'DAQheadNode');
                document.getElementById('DAQmasterCard').appendChild(this.masterBlock);

                this.collectorBlock = document.createElement('div');
                this.collectorBlock.setAttribute('id', 'collectorBlock');
                document.getElementById('DAQmasterCard').appendChild(this.collectorBlock);

                ////////////////////////////
                //Kinetic.js setup
                ////////////////////////////

                //indices for these arrays correspond to the x-card index on display
                this.stage = [];
                this.mainLayer = [];
                this.scaleLayer = [];
                this.tooltipLayer = [];
                this.TTbkg = [];
                this.text = [];
            },
            inserted: function() {},
            removed: function() {},
            attributeChanged: function() {}
        }, 
        events: { 

        },
        accessors: {
            'MIDAS':{
                attribute: {} //this just needs to be declared
            }
        }, 
        methods: {
            'buildDAQ' : function(response){
                var data = JSON.parse(response),
                    i, j, k, option,
                    collectorGutter = this.width*0.02,
                    collectorWidth = (this.width - collectorGutter*16) / 16,
                    xLength = collectorGutter/2,
                    xLeft, xRight, M, S, C;

                this.collectors = [];
                this.digitizers = [];
                this.collectorCells = [];
                this.localMSC = [];

                //determine what collectors are present and instantiate x-cards for each one
                for(i=0; i<16; i++){
                    this.collectors[i] = data.hosts['collector0x' + i.toString(16)];

                    if(this.collectors[i]){
                        document.getElementById('DAQdeck').innerHTML += '<x-card id="collector'+i+'"><div class="DAQheadNode" id="collectorDiv'+i+'""></div><div id="digitizerBlock'+i+'"></div></x-card>';
                        option = document.createElement('option');
                        option.value = this.nCards;
                        option.innerHTML = 'Collector 0x' + i.toString(16).toUpperCase();
                        this.cardNav.appendChild(option);
                        this.nCards++;
                    
                    }
                }

                //now that the xdeck is built, paint master canvas:
                //collectors:
                this.setupKinetic('collectorBlock');
                for(i=0; i<16; i++){
                    if(this.collectors[i]){
                        this.collectorCells[i] = new Kinetic.Rect({
                            x:collectorGutter/2 + i*this.width/16,
                            y:this.height*0.6,
                            width: collectorWidth,
                            height:this.height*0.2,
                            fill:'#555555',
                            stroke: '#000000',
                            strokeWidth: 4
                        });
                        this.collectorCells[i].on('click', this.clickCollector.bind(this, i)); 
                        this.collectorCells[i].on('mousemove', this.moveTooltip.bind(this) );
                        this.collectorCells[i].on('mouseover', this.writeCollectorTooltip.bind(this, i) );
                        this.collectorCells[i].on('mouseout', this.writeCollectorTooltip.bind(this, -1));
                        this.mainLayer[0].add(this.collectorCells[i]);

                        this.localMSC[i] = []
                    } else{
                        //terminate loose cord with red x
                        xLeft = new Kinetic.Line({
                            points: [(collectorGutter + collectorWidth)/2 + i*(collectorGutter+collectorWidth) - xLength, 0.6*this.height - xLength, (collectorGutter + collectorWidth)/2 + i*(collectorGutter+collectorWidth) + xLength, 0.6*this.height + xLength],
                            stroke: '#FF0000',
                            strokeWidth: 8   
                        });
                        xRight = new Kinetic.Line({
                            points: [(collectorGutter + collectorWidth)/2 + i*(collectorGutter+collectorWidth) + xLength, 0.6*this.height - xLength, (collectorGutter + collectorWidth)/2 + i*(collectorGutter+collectorWidth) - xLength, 0.6*this.height + xLength],
                            stroke: '#FF0000',
                            strokeWidth: 8
                        });
                        this.mainLayer[0].add(xLeft);
                        this.mainLayer[0].add(xRight);
                    }
                }

                //cabling:
                this.masterCables = [[],[],[],[]]; //1-to-4 cables: outer index counts master port, inner index counts collector
                for(i=0; i<4; i++){
                    this.masterCables[i][0] = new Kinetic.Line({
                        points: [collectorWidth*2 + collectorGutter*1.75 + i*(collectorWidth + collectorGutter)*4,0, collectorWidth*2 + collectorGutter*1.75 + i*(collectorWidth + collectorGutter)*4, 0.3*this.height],
                        stroke: '#000000',
                        strokeWidth: 4
                    });
                    this.mainLayer[0].add(this.masterCables[i][0]);
                    this.masterCables[i][0].moveToBottom();
                    for(j=1; j<5; j++){
                        this.masterCables[i][j] = new Kinetic.Line({
                            points: [collectorWidth*2 + collectorGutter*1.75 + i*(collectorWidth + collectorGutter)*4, 0.3*this.height, (collectorGutter + collectorWidth)/2 + (4*i+j-1)*(collectorGutter+collectorWidth), 0.6*this.height],
                            stroke: '#000000',
                            strokeWidth: 4
                        });
                        this.mainLayer[0].add(this.masterCables[i][j]);
                        this.masterCables[i][j].moveToBottom();
                    }
                }
                this.mainLayer[0].draw();
                
                //and again for each collector card
                this.digitizerCells = [];
                this.collectorCables = [];
                for(i=0; i<16; i++){
                    this.digitizerCells[i] = [];

                    if(!this.collectors[i]) continue;

                    this.setupKinetic('digitizerBlock'+i);
                    for(j=0; j<16; j++){
                        if(data.hosts['collector0x' + i.toString(16)].digitizers[j]){
                            this.digitizerCells[i][j] = new Kinetic.Rect({
                                x:collectorGutter/2 + j*this.width/16,
                                y:this.height*0.6,
                                width: collectorWidth,
                                height:this.height*0.2,
                                fill:'#555555',
                                stroke: '#000000',
                                strokeWidth: 4
                            });
                            this.digitizerCells[i][j].on('mousemove', this.moveTooltip.bind(this) );
                            this.digitizerCells[i][j].on('mouseover', this.writeDigitizerTooltip.bind(this, j) );
                            this.digitizerCells[i][j].on('mouseout', this.writeDigitizerTooltip.bind(this, -1));
                            this.mainLayer[i+1].add(this.digitizerCells[i][j]);

                            this.localMSC[i][j] = [];
                        } else{
                            //terminate loose cord with red x
                            xLeft = new Kinetic.Line({
                                points: [(collectorGutter + collectorWidth)/2 + j*(collectorGutter+collectorWidth) - xLength, 0.6*this.height - xLength, (collectorGutter + collectorWidth)/2 + j*(collectorGutter+collectorWidth) + xLength, 0.6*this.height + xLength],
                                stroke: '#FF0000',
                                strokeWidth: 8   
                            });
                            xRight = new Kinetic.Line({
                                points: [(collectorGutter + collectorWidth)/2 + j*(collectorGutter+collectorWidth) + xLength, 0.6*this.height - xLength, (collectorGutter + collectorWidth)/2 + j*(collectorGutter+collectorWidth) - xLength, 0.6*this.height + xLength],
                                stroke: '#FF0000',
                                strokeWidth: 8
                            });
                            this.mainLayer[i+1].add(xLeft);
                            this.mainLayer[i+1].add(xRight);
                        }

                    }

                    //cabling:
                    this.collectorCables[i] = [];
                    for(j=0; j<4; j++){
                        this.collectorCables[i][j] = [];
                        this.collectorCables[i][j][0] = new Kinetic.Line({
                            points: [collectorWidth*2 + collectorGutter*1.75 + j*(collectorWidth + collectorGutter)*4,0, collectorWidth*2 + collectorGutter*1.75 + j*(collectorWidth + collectorGutter)*4, 0.3*this.height],
                            stroke: '#000000',
                            strokeWidth: 4
                        });
                        this.mainLayer[i+1].add(this.collectorCables[i][j][0]);
                        this.collectorCables[i][j][0].moveToBottom();
                        for(k=1; k<5; k++){
                            this.collectorCables[i][j][k] = new Kinetic.Line({
                                points: [collectorWidth*2 + collectorGutter*1.75 + j*(collectorWidth + collectorGutter)*4, 0.3*this.height, (collectorGutter + collectorWidth)/2 + (4*j+k-1)*(collectorGutter+collectorWidth), 0.6*this.height],
                                stroke: '#000000',
                                strokeWidth: 4
                            });
                            this.mainLayer[i+1].add(this.collectorCables[i][j][k]);
                            this.collectorCables[i][j][k].moveToBottom();
                        }
                    }
                    this.mainLayer[i+1].draw();

                }

                //build the MSC table in per-digitizer chunks
                //this.localMSC[collector index][digitizer index][ADC index] = channel name
                for(i=0; i<data.MSC.MSC.length; i++){
                    M = (parseInt(data.MSC.MSC[i],10) & 0xF000) >> 12;
                    S = (parseInt(data.MSC.MSC[i],10) & 0x0F00) >> 8;
                    C = parseInt(data.MSC.MSC[i],10) & 0x00FF;

                    this.localMSC[M][S][data.MSC.chan[i]] = data.MSC.MSC[i];
                }

            },

            'setupKinetic' : function(targetID){
                var i = this.stage.length;
                //point kinetic at the div and set up the staging and layers:
                this.stage[i] = new Kinetic.Stage({
                    container: targetID,
                    width: this.width,
                    height: this.height
                });
                this.mainLayer[i] = new Kinetic.Layer();       //main rendering layer
                this.scaleLayer[i] = new Kinetic.Layer();      //layer for scales / legends
                this.tooltipLayer[i] = new Kinetic.Layer();    //layer for tooltip info

                //tooltip background:
                this.TTbkg[i] = new Kinetic.Rect({
                    x:-1000,
                    y:-1000,
                    width:100,
                    height:100,
                    fill:'rgba(0,0,0,0.8)',
                    stroke: 'rgba(0,0,0,0)',
                    listening: false
                });
                this.tooltipLayer[i].add(this.TTbkg[i]);

                //tooltip text:
                this.text[i] = new Kinetic.Text({
                    x: -1000,
                    y: -1000,
                    fontFamily: 'Arial',
                    fontSize: 16,
                    text: '',
                    lineHeight: 1.2,
                    fill: '#EEEEEE',
                    listening: false
                });
                this.tooltipLayer[i].add(this.text[i]);

                this.stage[i].add(this.mainLayer[i]);
                this.stage[i].add(this.scaleLayer[i]);
                this.stage[i].add(this.tooltipLayer[i]);
            },

            'clickCollector' : function(index){
                //document.getElementById('DAQdeck').shuffleTo(index+1);
                document.getElementById('DAQnav').value = index+1;
                document.getElementById('DAQnav').onchange();
            },

            'moveTooltip': function(){
                var mousePos = this.stage[this.showing].getPointerPosition(),
                    TTwidth = this.TTbkg[this.showing].getAttr('width'),
                    TTheight = this.TTbkg[this.showing].getAttr('height');

                //adjust the background size & position
                this.TTbkg[this.showing].setAttr( 'x', Math.min(mousePos.x + 10, this.width - TTwidth) );
                this.TTbkg[this.showing].setAttr( 'y', Math.min(mousePos.y + 10, this.height - TTheight) );
                //make text follow the mouse too
                this.text[this.showing].setAttr( 'x', Math.min(mousePos.x + 20, this.width - TTwidth + 10) );
                this.text[this.showing].setAttr( 'y', Math.min(mousePos.y + 20, this.height - TTheight) ); 

                this.tooltipLayer[this.showing].draw();
            },

            'writeCollectorTooltip' : function(i){
                var text;

                if(i!=-1){
                    text = 'Collector 0x' + i.toString(16);
                } else {
                    text = '';
                }
                this.text[this.showing].setText(text);
                if(text != ''){
                    //adjust the background size
                    this.TTbkg[this.showing].setAttr( 'width', this.text[this.showing].getAttr('width') + 20 );
                    this.TTbkg[this.showing].setAttr( 'height', this.text[this.showing].getAttr('height') + 20 ); 
                } else {
                    this.TTbkg[this.showing].setAttr('width', 0);
                    this.TTbkg[this.showing].setAttr('height', 0);                    
                }
                this.tooltipLayer[this.showing].draw();
            },

            'writeDigitizerTooltip' : function(i){
                var text, key;

                if(i!=-1){
                    text = 'Digitizer 0x' + i.toString(16);
                    for(key in this.localMSC[this.showing-1][i]){
                        text += '\n' + key + ' 0x' + this.localMSC[this.showing-1][i][key].toString(16);
                    }
                } else {
                    text = '';
                }
                this.text[this.showing].setText(text);
                if(text != ''){
                    //adjust the background size
                    this.TTbkg[this.showing].setAttr( 'width', this.text[this.showing].getAttr('width') + 20 );
                    this.TTbkg[this.showing].setAttr( 'height', this.text[this.showing].getAttr('height') + 20 ); 
                } else {
                    this.TTbkg[this.showing].setAttr('width', 0);
                    this.TTbkg[this.showing].setAttr('height', 0);                    
                }
                this.tooltipLayer[this.showing].draw();
            }
        }
    });

})();