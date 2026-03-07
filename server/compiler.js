const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

function compileCpp(code, input = "") {
  return new Promise((resolve) => {
    const uniqueId = Date.now();
    const cppFile = `temp_${uniqueId}.cpp`;
    const exeFile = `temp_${uniqueId}.exe`;
    const inputFile = `input_${uniqueId}.txt`;

    fs.writeFileSync(cppFile, code);
    fs.writeFileSync(inputFile, input);

    // Command: Compile then run with input redirection
    const command = `g++ ${cppFile} -o ${exeFile} && ${exeFile} < ${inputFile}`;

    exec(command, (err, stdout, stderr) => {
      // Cleanup files
      [cppFile, exeFile, inputFile].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });

      if (err) {
        resolve({ success: false, output: stderr || err.message });
      } else {
        resolve({ success: true, output: stdout });
      }
    });
  });
}

module.exports = { compileCpp };