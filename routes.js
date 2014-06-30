///////////////////////////////////////
//get requests
///////////////////////////////////////

app.get('/HV', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)

	res.render('widgets/HV.jade');
});

app.get('/GRIFFIN', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('detectors/GRIFFIN.jade');
});

app.get('/DAQ', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('widgets/DAQ.jade');
});

app.get('/PPG', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('widgets/PPG.jade');
});

app.get('/Clocks', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('widgets/Clock.jade');
});

app.get('/Filter', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('widgets/Filter.jade');
});

app.get('/MSCbuilder', function(req, res){
	if(!req.cookies.midas_pwd) res.redirect(MIDAS)
	
	res.render('widgets/MSCbuilder.jade');
});

///////////////////////////////////////
//post routes
///////////////////////////////////////

app.post('/postHV', function(req, res){

	spawn('odbedit', ['-c', "set /Equipment/HV-"+req.body.crateIndex+"/Variables/Demand["+req.body.chIndex+"] " + req.body.demandVoltage]);
	spawn('odbedit', ['-c', "set '/Equipment/HV-"+req.body.crateIndex+"/Settings/Ramp Up Speed["+req.body.chIndex+"]' " + req.body.voltageUp]);
	spawn('odbedit', ['-c', "set '/Equipment/HV-"+req.body.crateIndex+"/Settings/Ramp Down Speed["+req.body.chIndex+"]' " + req.body.voltageDown]);

	if(req.body.powerSwitch == 'off')
		spawn('odbedit', ['-c', "set /Equipment/HV-"+req.body.crateIndex+"/Settings/ChState["+req.body.chIndex+"] 0"]);
	else
		spawn('odbedit', ['-c', "set /Equipment/HV-"+req.body.crateIndex+"/Settings/ChState["+req.body.chIndex+"] 1"]);

	return res.redirect('/HV?crate=0&channel='+req.body.chName);
});

app.post('/registerCycle', function(req, res){
	var cycle = (req.body.cycleString) ? JSON.parse(req.body.cycleString) : null,
		i,
		steps = [],
		durations = [];

	//just load an existing cycle
	if(req.body.loadTarget != 'null'){
		spawn('odbedit', ['-c', "set /PPG/Current " + req.body.loadTarget]);
		return res.redirect('/PPG');
	}

	//delete an existing cycle
	if(req.body.deleteTarget != 'null'){
		spawn('odbedit', ['-c', "rm /PPG/Cycles/" + req.body.deleteTarget]);
		return res.redirect('/PPG');
	}

	//register a new cycle
	for(i=0; i<cycle.length; i++){
		steps[i] = parseInt(cycle[i].PPGcode, 10);
		durations[i] = parseInt(cycle[i].duration, 10);
	}

	spawn('odbedit', ['-c', "rm /PPG/Cycles/" + req.body.cycleName]);
	spawn('odbedit', ['-c', "mkdir /PPG/Cycles/" + req.body.cycleName]);
	
	spawn('odbedit', ['-c', "create int /PPG/Cycles/" + req.body.cycleName + "/PPGcodes[" + steps.length + "]"]);
	spawn('odbedit', ['-c', "create int /PPG/Cycles/" + req.body.cycleName + "/durations[" + steps.length + "]"]);
	for(i=0; i<cycle.length; i++){
		spawn('odbedit', ['-c', "set /PPG/Cycles/" + req.body.cycleName + "/PPGcodes["+ i +"]  " + Math.round(steps[i]) ]);
		spawn('odbedit', ['-c', "set /PPG/Cycles/" + req.body.cycleName + "/durations["+ i +"]  " + Math.round(durations[i]) ]);
	}

	if(req.body.applyCycle == 'on'){
		spawn('odbedit', ['-c', "set /PPG/Current " + req.body.cycleName]);
	}

	return res.redirect('/PPG');
});

app.post('/registerFilter', function(req, res){
	var filter = (req.body.filterString) ? JSON.parse(req.body.filterString) : null,
		odbManipulationFile = '',
		i, j,
		steps = [],
		durations = [];


	//just load an existing cycle
	if(req.body.loadTarget != 'null'){
		spawn('odbedit', ['-c', "set /Filter/Current " + req.body.loadTarget]);
		return res.redirect('/Filter');
	}

	//delete an existing cycle
	if(req.body.deleteTarget != 'null'){
		spawn('odbedit', ['-c', "rm /Filter/Filters/" + req.body.deleteTarget]);
		return res.redirect('/Filter');
	}

	//register a new filter - build file and run with execFile for most robust execution (spawn seems to create a race condition, consider removing).
	odbManipulationFile += 'odbedit -c "rm /Filter/Filters/' + req.body.filterName + '"\n';
	odbManipulationFile += 'odbedit -c "mkdir /Filter/Filters/' + req.body.filterName + '"\n';
	for(i=0; i<filter.length; i++){
		odbManipulationFile += 'odbedit -c "create string /Filter/Filters/' + req.body.filterName + '/orCondition'+i+'[' + filter[i].length + ']"\n'; 
		for(j=0; j<filter[i].length; j++){
			odbManipulationFile += 'odbedit -c "set /Filter/Filters/' + req.body.filterName + '/orCondition'+i + '['+j+'] ' + filter[i][j] + '"\n';
		}
	}

	fs.writeFile('odbManipulation.sh', odbManipulationFile, function(){
		fs.chmod('./odbManipulation.sh', '777', function(){
			execFile('./odbManipulation.sh', function(error, stdout, stderr){
				console.log('Writing ' + req.body.filterName + ' filter to ODB, process [error, stdout, stderr]:'); 
				console.log([error, stdout, stderr]);

				if(req.body.applyFilter == 'on'){
					spawn('odbedit', ['-c', "set /Filter/Current " + req.body.filterName]);
				}
			});			
		});
	});
	
	return res.redirect('/Filter');

});

app.post('/updateClock', function(req, res){
	var ClockEnB = 0,
		powerOn,
		stepdown = parseInt(req.body.freqStepdown,10);

	//channel on / off
	for(i=0; i<6; i++){
		powerOn = req.body['eSATAtoggle' + i] == 1
		ClockEnB = ClockEnB | ((powerOn) ? (0xF << 4*i) : 0);
	}
	spawn('odbedit', ['-c', "set /Equipment/GRIF-Clk" + req.body.clockIndex + "/Variables/Output[0] " + ClockEnB]);

	//freq. stepdown
	if(stepdown && req.body.isMaster=='1'){
		for(i=0; i<8; i++){
			spawn('odbedit', ['-c', "set /Equipment/GRIF-Clk" + req.body.clockIndex + "/Variables/Output[" + (11+4*i) + "] " + stepdown]);
			spawn('odbedit', ['-c', "set /Equipment/GRIF-Clk" + req.body.clockIndex + "/Variables/Output[" + (12+4*i) + "] " + stepdown]);		
		}
	}

	return res.redirect('/Clocks');
});

app.post('/toggleClock', function(req, res){
	spawn('odbedit', ['-c', "set /Equipment/GRIF-Clk" + req.body.clockIndex + "/Variables/Output[1] " + req.body['radio'+req.body.clockIndex] ]);

	return res.redirect('/Clocks');
});

app.post('/buildMSC', function(req, res){

	console.log(req.body)

	var names = [],
		MSC = [],
		table, i;

	for(i=1; i<17, i++){
		if(req.body['crystal' + i] == 'on'){
			table = configGRIFFINclover(i, req.body['suppressor'+i] == 'on');
			names.concat(table[0]);
			MSC.concat(table[1]);
		}
	}
console.log(names)
console.log(MSC)
	function configGRIFFINclover(index, suppressors){
		var names = [],
			MSC = [],
			masterChan = (index<9) ? 0 : 1,
			firstCollectorChan = ((index-1)%8)*2, //ie, collector channel of first (of 2) GRIF16s used for this clover.
			collectorChan,  
			ADC,
			name, address,
			crystalPrefix = 'GRG' + ((index<10) ? '0'+index : index),
			color = ['B', 'G', 'R', 'W'],
			crystalSuffix = ['N00A', 'N00B'],
			vetoPrefix = 'GRS' + ((index<10) ? '0'+index : index),
			i,j,k;

		if(suppressors){
			//HPGe
			for(i=0; i<crystalSuffix.length; i++){
				for(j=0; j<color.length; j++){
					name = crystalPrefix + color[j] + crystalSuffix[i];

					collectorChan = firstCollectorChan + i;
					ADC = j;
					address = (masterChan << 12) | (collectorChan << 8) | ADC;

					names.push(name);
					MSC.push(address);
				}
			}

			//BGO
			for(j=0; j<color.length; j++){
				for(i=0; i<5; i++){
					name = vetoPrefix + color[j] + 'N0' + i + 'X';

					collectorChan = firstCollectorChan + ((j<2) ? 0 : 1);
					ADC = 5 + (j%2)*5+i;
					address = (masterChan << 12) | (collectorChan << 8) | ADC;

					names.push(name);
					MSC.push(address);
				}
			}

		} else{
			for(i=0; i<crystalSuffix.length; i++){
				for(j=0; j<color.length; j++){
					name = crystalPrefix + color[j] + crystalSuffix[i];

					collectorChan = firstCollectorChan;
					ADC = j + 4*i;
					address = (masterChan << 12) | (collectorChan << 8) | ADC;

					names.push(name);
					MSC.push(address);
				}
			}			
		}

		return [names, MSC];
	}

	function configSCEPTAR(US, DS, ZDS){
		var names = [],
			MSC = [],
			i;

		if(DS){
			for(i=1; i<11; i++){
				names.push('SEP' + ((i<10) ? '0'+i : i) + 'XN00X');
				MSC.push((2 << 12) | ( (4+Math.floor((i-1)/4)) << 8) | (i-1)%4);
			}
		} else if(ZDS){
			names.push('ZDS01XN00X');
			MSC.push(0x2601);
			names.push('ZDS01XT00X');
			MSC.push(0x2208);
		}

		if(US){
			for(i=11; i<21; i++){
				names.push('SEP' + i + 'XN00X');
				MSC.push((2 << 12) | ( ( 6 + Math.floor((i - 11 + 2)/4) ) << 8) | (i+3)%4);
			}
		}

		return [names, MSC];
	}

	function configDANTE(){
		var names = [],
			MSC = [],
			i;

		for(i=0; i<8; i++){
			names.push('DAL0'+(1+i)+'XN00X');
			MSC.push((2 << 12) | ( 1 << 8) | i);
		}

		for(i=0; i<8; i++){
			names.push('DAL0'+(1+i)+'XT00X');
			MSC.push((2 << 12) | ( 2 << 8) | i);
		}

		return [names, MSC];

	}

	function configPACES(){
		var names = ['PAC01XN00X', 'PAC02XN00X', 'PAC03XN00X', 'PAC04XN00X', 'PAC05XN00X'],
			MSC = [0x2000, 0x2001, 0x2002, 0x2003, 0x2004];

			return [names, MSC];
	}

	return res.redirect('/DAQ');

});

