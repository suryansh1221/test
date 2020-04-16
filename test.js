const https = require("https");
const pdfreader = require("pdfreader");
const readline = require('readline');
const Stack = require('stack-lifo');
const csv = require('csv-parser');
const fs = require('fs');

let stack_op = new Stack();
let stack_val = new Stack();
let url = []
let resume_count = 0
let url_mapp = []

async function bufferize(url) {
  var hn = url.substring(url.search("//") + 2);
  hn = hn.substring(0, hn.search("/"));
  var pt = url.substring(url.search("//") + 2);
  pt = pt.substring(pt.search("/"));
  const options = { hostname: hn, port: 443, path: pt, method: "GET" };
  return new Promise(function(resolve, reject) {
    var buff = new Buffer.alloc(0);
    const req = https.request(options, res => {
      res.on("data", d => {
        buff = Buffer.concat([buff, d]);
      });
      res.on("end", () => {
        resolve(buff);
      });
    });
    req.on("error", e => {
      console.error("https request error: " + e);
    });
    req.end();
  });
}

/*
if second param is set then a space ' ' inserted whenever text 
chunks are separated by more than xwidth 
this helps in situations where words appear separated but
this is because of x coords (there are no spaces between words) 

each page is a different array element
*/
async function readlines(buffer, xwidth) {
  return new Promise((resolve, reject) => {
    var pdftxt = new Array();
    var pg = 0;
    new pdfreader.PdfReader().parseBuffer(buffer, function(err, item) {
      if (err) console.log("pdf reader error: " + err);
      else if (!item) {
        pdftxt.forEach(function(a, idx) {
          pdftxt[idx].forEach(function(v, i) {
            pdftxt[idx][i].splice(1, 2);
          });
        });
        resolve(pdftxt);
      } else if (item && item.page) {
        pg = item.page - 1;
        pdftxt[pg] = [];
      } else if (item.text) {
        var t = 0;
        var sp = "";
        pdftxt[pg].forEach(function(val, idx) {
          if (val[1] == item.y) {
            if (xwidth && item.x - val[2] > xwidth) {
              sp += " ";
            } else {
              sp = "";
            }
            pdftxt[pg][idx][0] += sp + item.text;
            t = 1;
          }
        });
        if (t == 0) {
          pdftxt[pg].push([item.text, item.y, item.x]);
        }
      }
    });
  });
}

const getCsv = async () => {
	await fs.createReadStream('./upload.csv')
	  .pipe(csv())
	  .on('data', (row) => {
	    url.push(row.Resume)
	    // console.log(row)
	    url_mapp[resume_count] = row['First Name'] + " " + row['Last Name ']
	    resume_count++
	  })
	  .on('end', () => {
	    console.log('CSV file successfully processed');
	    input()
	  });
	  
}

const getData = async (i) => {
  
  let buffer = await bufferize(url[i]);
  let lines = await readlines(buffer);
  lines = await (JSON.stringify(lines));
  return lines;


};
// getData()
function precedence(op){ 
	if(op === '+'||op === '-') 
	return 1; 
	if(op === '*'||op === '/') 
	return 2; 
	return 0; 
} 
const input = async () => {
	let arr = [];
	let mapp = {}
	let final_mapp = {}
	for(var i = 0; i < resume_count; i++){
		let data =  await getData(i)
		arr.push(data)
	}
	for(var i = 0; i < resume_count; i++){

		let data = arr[i];
		data = data.match(/\b(\w+)\b/g)
		for(var j = 0; j < data.length; j++)data[j] = data[j].toLowerCase()
		data = new Set(data)
		const final = [...data]
		// console.log(final)
		for(var j = 0; j < final.length; j++){
			if(final[j] !== 'is' && final[j] !== 'and' && final[j] !== 'the' && final[j] !== 'would'){
			if(final[j] in mapp){
				mapp[final[j]].push(i)
			}else{
				mapp[final[j]] = [];
				mapp[final[j]].push(i)
			}}
		}
	}

	let answer1 ;
	let rl = readline.createInterface({
	  input: process.stdin,
	  output: process.stdout
	});

	const ans =  rl.question("Enter the query ",   function(answer) {
		answer = answer.toLowerCase()
		var	res = answer.replace(/ or /g,"+")
		res = res.replace(/ and /g, '*')
		res = res.replace(/ /g, '')
		// console.logx(res)


		for(var  i = 0; i < res.length; i++){
			// console.log(i)
			if(res[i] === '('){
				stack_op.push(res[i])
			}else if(res[i] !== '(' && res[i] !== ')' && res[i] !== '+' && res[i] !== '*'){
				let str = ''
				if(res[i] === '"')i++;
				while(res[i] >= 'a' && res[i] <= 'z' ){
					str = str + res[i]; 
					i++
				}
				if(res[i] === '"')i++;
				stack_val.push(str)
				final_mapp[str] = mapp[str]
				i--;
			}else if(res[i] === ')'){
				while(!stack_op.isEmpty() && stack_op.peek() !== '('){
					let str = stack_val.peek()
					stack_val.pop()
					let str2 = stack_val.peek()
					stack_val.pop()
					let opp = stack_op.peek()
					stack_op.pop()

					stack_val.push(str+opp+str2)

					// console.log(str+opp+str2+":")

					if(opp === '+'){
						let arr1 = mapp[str]
						let arr2 = mapp[str2]
						if(arr1 === undefined){arr1=[]}
						if(arr2 === undefined){arr2=[]}
						// console.log(arr2)
						let arr3 = [...arr2, ...arr1]
						arr3 = new Set(arr3)
						const final_arr3 = [...arr3]
						final_mapp[str+opp+str2] = final_arr3

					}else if(opp === '*'){
						let arr1 = mapp[str]
						let arr2 = mapp[str2]
						let arr3 = []
						if(arr1 === undefined || arr2 === undefined){
							final_mapp[str+opp+str2] = []
							continue
						}
						// console.log(arr1, arr2, arr3)
						for(let k = 0; k < arr1.length; k++){
							if(arr2.indexOf(arr1[k]) !== -1){
								arr3.push(arr1[k])
							}
						}
						final_mapp[str+opp+str2] = arr3
					}
				}
				if(!stack_op.isEmpty())
					stack_op.pop()
			} else {
				while(!stack_op.isEmpty() && precedence(stack_op.peek()) >= precedence(res[i])){
					let str = stack_val.peek()
					stack_val.pop()
					let str2 = stack_val.peek()
					stack_val.pop()
					let opp = stack_op.peek()
					stack_op.pop()
					stack_val.push(str+opp+str2)
					// console.log(str+opp+str2)
					
					if(opp === '+'){
						let arr1 = final_mapp[str]
						let arr2 = final_mapp[str2]
						let arr3 = [...arr2, ...arr1]
						arr3 = new Set(arr3)
						const final_arr3 = [...arr3]
						final_mapp[str+opp+str2] = final_arr3
					}else if(opp === '*'){
						let arr1 = final_mapp[str]
						let arr2 = final_mapp[str2]
						let arr3 = []
						if(arr1 === undefined || arr2 === undefined){
							final_mapp[str+opp+str2] = []
							continue
						}
						// console.log(arr1, arr2, arr3)
						for(let k = 0; k < arr1.length; k++){
							if(arr2.indexOf(arr1[k]) !== -1){
								arr3.push(arr1[k])
							}
						}
						final_mapp[str+opp+str2] = arr3
					}
				}
				stack_op.push(res[i])
			}
		}
		while(!stack_op.isEmpty()){
			let str = stack_val.peek()
			stack_val.pop()
			let str2 = stack_val.peek()
			stack_val.pop()
			let opp = stack_op.peek()
			stack_op.pop()
			stack_val.push(str+opp+str2)
			// console.log(str+opp+str2)

			if(opp === '+'){
				let arr1 = final_mapp[str]
				let arr2 = final_mapp[str2]
				let arr3 = [...arr2, ...arr1]
				arr3 = new Set(arr3)
				const final_arr3 = [...arr3]
				final_mapp[str+opp+str2] = final_arr3
			}else if(opp === '*'){
				let arr1 = final_mapp[str]
				let arr2 = final_mapp[str2]
				let arr3 = []
				if(arr1 === undefined || arr2 === undefined){
					final_mapp[str+opp+str2] = []
					continue
				}
				// console.log(arr1, arr2, arr3)
				for(let k = 0; k < arr1.length; k++){
					if(arr2.indexOf(arr1[k]) !== -1){
						arr3.push(arr1[k])
					}
				}
				final_mapp[str+opp+str2] = arr3
			}

		}

		let result = final_mapp[stack_val.peek()]
		result = result.map((ele) => url_mapp[ele])
		console.log(result)
		rl.close();
	})
	// let data1 = data.match(/\b(\w+)\b/g)
	// console.log(data1)	
}
getCsv()
// input()
