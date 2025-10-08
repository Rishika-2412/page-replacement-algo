let selectedAlgorithm = null;

// Select algorithm button
function selectAlgorithm(algo) {
  selectedAlgorithm = algo;
  document.querySelectorAll("#algoButtons .btn").forEach(btn => {
    if (btn.innerText === algo) btn.classList.add("active");
    else btn.classList.remove("active");
  });
}

// Run simulation
function runSimulation() {
  const refString = document.getElementById("referenceString").value.trim().split(/\s+/).map(Number);
  const frames = parseInt(document.getElementById("frames").value);

  if (!refString.length || isNaN(frames)) { alert("Enter valid input"); return; }
  if (!selectedAlgorithm) { alert("Please select an algorithm!"); return; }

  let { processTable, executionSummary } = simulate(refString, frames, selectedAlgorithm);
  document.getElementById("processTable").innerHTML = processTable;
  document.getElementById("processTableHeading").style.display = "block";
  document.getElementById("executionSummary").innerHTML = executionSummary;
  document.getElementById("comparisonSection").style.display = "none";
}

// Reset simulation
function resetSimulation() {
  document.getElementById("referenceString").value = "";
  document.getElementById("frames").value = "3";
  document.getElementById("processTable").innerHTML = "";
  document.getElementById("processTableHeading").style.display = "none";
  document.getElementById("executionSummary").innerHTML = "";
  document.getElementById("comparisonSection").style.display = "none";
  selectedAlgorithm = null;
  document.querySelectorAll("#algoButtons .btn").forEach(btn => btn.classList.remove("active"));
}

// Compare algorithms
function compareAlgorithms() {
  const refString = document.getElementById("referenceString").value.trim().split(/\s+/).map(Number);
  const frames = parseInt(document.getElementById("frames").value);

  if (!refString.length || isNaN(frames)) { alert("Enter valid input"); return; }

  const algos = ["FIFO", "LRU", "Optimal"];
  let results = [];
  algos.forEach(algo => {
    let { hits, faults } = simulateForCompare(refString, frames, algo);
    results.push({ algo, hits, faults, hitRatio: (hits/refString.length).toFixed(2), faultRatio: (faults/refString.length).toFixed(2) });
  });

  let compHTML = "<table class='table table-bordered'><tr><th>Algorithm</th><th>Hits</th><th>Faults</th><th>Hit Ratio</th><th>Fault Ratio</th></tr>";
  results.forEach(r => {
    compHTML += `<tr>
      <td>${r.algo}</td>
      <td>${r.hits}</td>
      <td>${r.faults}</td>
      <td>${r.hitRatio}</td>
      <td>${r.faultRatio}</td>
    </tr>`;
  });
  compHTML += "</table>";

  document.getElementById("comparisonResults").innerHTML = compHTML;
  document.getElementById("comparisonSection").style.display = "block";
}

// Simulation
function simulate(refString, frames, algo) {
  let memoryStates = Array.from({ length: frames }, () => []);
  let memory = [], faults = 0, hits = 0, recentUse = {}, hitFaultRow = [];

  refString.forEach((page, i) => {
    if (memory.includes(page)) hits++, hitFaultRow[i] = "Hit";
    else {
      faults++, hitFaultRow[i] = "Fault";
      if (memory.length < frames) memory.push(page);
      else {
        if (algo==="FIFO"){ memory.shift(); memory.push(page); }
        else if (algo==="LRU"){ let lruPage = memory.reduce((a,b)=>recentUse[a]<recentUse[b]?a:b); memory[memory.indexOf(lruPage)] = page; }
        else if (algo==="Optimal"){ 
          let future=refString.slice(i+1); 
          let replace=memory.findIndex(m=>future.indexOf(m)===-1); 
          if(replace===-1){ let farthest=-1,victim=0; memory.forEach((m,idx)=>{let pos=future.indexOf(m); if(pos>farthest){farthest=pos;victim=idx;}}); replace=victim; }
          memory[replace]=page;
        }
      }
    }
    recentUse[page]=i;
    for(let f=0;f<frames;f++) memoryStates[f][i]=memory[f]!==undefined?memory[f]:"";
  });

  let tableHTML="<table class='table table-bordered'><tr>";
  for(let i=0;i<refString.length;i++) tableHTML+=`<th>${i+1}</th>`; tableHTML+="</tr>";
  memoryStates.forEach(row=>{ tableHTML+="<tr>"; row.forEach(val=>tableHTML+=`<td>${val}</td>`); tableHTML+="</tr>"; });
  tableHTML+="<tr>"; hitFaultRow.forEach(val=>tableHTML+=`<td style="font-weight:bold;color:${val==="Hit"?"green":"red"}">${val}</td>`); tableHTML+="</tr></table>";

  let executionHTML=`<p><b>Total References:</b> ${refString.length}</p><p><b>Frames:</b> ${frames}</p><p><b>Algorithm:</b> ${algo}</p><p><b>Hits:</b> ${hits}</p><p><b>Faults:</b> ${faults}</p>`;

  return { processTable: tableHTML, executionSummary: executionHTML };
}

// Simulation for comparison
function simulateForCompare(refString, frames, algo) {
  let memory=[], faults=0, hits=0, recentUse={};
  refString.forEach((page,i)=>{
    if(memory.includes(page)) hits++;
    else{
      faults++;
      if(memory.length<frames) memory.push(page);
      else{
        if(algo==="FIFO"){ memory.shift(); memory.push(page); }
        else if(algo==="LRU"){ let lruPage=memory.reduce((a,b)=>recentUse[a]<recentUse[b]?a:b); memory[memory.indexOf(lruPage)]=page; }
        else if(algo==="Optimal"){
          let future=refString.slice(i+1);
          let replace=memory.findIndex(m=>future.indexOf(m)===-1);
          if(replace===-1){ let farthest=-1,victim=0; memory.forEach((m,idx)=>{let pos=future.indexOf(m); if(pos>farthest){farthest=pos;victim=idx;}}); replace=victim;}
          memory[replace]=page;
        }
      }
    }
    recentUse[page]=i;
  });
  return { hits, faults };
}
