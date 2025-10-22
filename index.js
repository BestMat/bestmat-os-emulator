const memory = [];
const os = document.getElementById("os");
const bios = document.getElementById("bios");
const factor = 40;
let bios_content = "";
let adr = 0x7C00;
os.style.backgroundColor = "#181818";
os.width = 16 * factor;
os.height = 9 * factor;
os.hidden = true;
bios.style.backgroundColor = "#181818";
bios.style.width = String(16 * factor - 4) + "px";
bios.style.height = String(9 * factor) + "px";
bios.style.resize = "none";
bios.style.border = "none";
bios.style.color = "#ffffff";
bios.style.padding = "20px";
bios_content = bios_content + "BestMat OS Emulator: BIOS\n";
bios.value = bios_content;
class Register {
    static registers = {reg0: 0, reg1: 0, reg2: 0, reg3: 0, reg4: 0,
			sp: 0, if_flag: 1};

    static get(register) {
	let value = this.registers[register];
	if (register.includes("_") && !register.includes("flag")) {
	    const reg_split = register.split("_");
	    value = this.registers[reg_split[0]];
	    if (reg_split[1] == "high") { // higher 8 bits
		return value >> 8; 
	    } else { // lower 8 bits
		return value & 0xFF; 
	    }
	}

	return value;
    }

    static set(register, value) {
	if (value < -32_768 || value > 32_767) {
	    throw new Error("Value " + value + " must be 16 bit integer.");
	    return;
	}
	
	if (register.includes("_") && !register.includes("flag")) {
	    const reg_split = register.split("_");
	    if (reg_split[1] == "high") { // higher 8 bits
		const original_value = this.get(reg_split[0]);
		const new_value = (original_value & 0x00FF) | (value << 8);
		this.registers[reg_split[0]] = new_value;
	    } else { // lower 8 bits
		const original_value = this.get(reg_split[0]);
		const new_value = (original_value & 0xFF00) | value;
		this.registers[reg_split[0]] = new_value;
	    }
	    return;
	}

	this.registers[register] = value;
    }
}

function bios_interrupt(code) {
    if (Register.get("if_flag") == 0) return;
    const high = Register.get("reg0_high");
    const low = Register.get("reg0_low");
    if (code == 0x10) {
	if (high == 0x0E) {
	    // TODO: Implement page_number and foreground_color
	    const page_number = Register.get("reg1_high");
	    const foreground_color = Register.get("reg1_low");
	    if (low == 12) {
		bios_content = bios_content + '\n';
		bios.value = bios_content;
		return;
	    }
	    
	    bios_content = bios_content + String.fromCharCode(low);
	    bios.value = bios_content;
	}
    }
}

function str(register, value) {
    Register.set(register, value);
}

function push(value) {
    str("sp", Register.get("sp") - 1); // stack grows downwards
    memory[Register.get("sp")] = value;
}

function pop() {
    str("sp", Register.get("sp") + 1);
}

function xor(operand1, operand2) {
    str(operand1, Register.get(operand1) ^ Register.get(operand2));
}

function inc(register) {
    str(register, Register.get(register) + 1);
}

function sti() {
    Register.set("if_flag", 1);
}

function int(code) {
    bios_interrupt(code);
}

function cli() {
    Register.set("if_flag", 0);
}

// str reg0_high, 0x0E
// str reg0_low, 85
// int 0x10 
// str reg0_low, 12
// int 0x10 
// str sp, 0x7C00 
str("reg0_high", 0x0E);
str("reg0_low", 85); // ASCII Code of 'U' is 85
int(0x10);
str("reg0_low", 12); // ASCII Code of '\n' is 12
int(0x10);
str("sp", 0x7C00);

// string: "Hello, World!\n\0"
// str reg1, &string
const string = "Hello, World!\n\0";
for (let i = 0; i < string.length; ++i) {
    memory[adr + i] = string[i];
}

str("reg4", adr); // reg4 is temporarily source index (si) register
adr += string.length;

while (memory[Register.get("reg4")] != '\0') {
    str("reg0_low", memory[Register.get("reg4")].charCodeAt());
    int(0x10);
    // inc reg1
    inc("reg4");
}

// push 1
// push 2
// pop
push(1);
push(2);
pop();

// xor reg4, reg4
// cli
xor("reg4", "reg4");
cli();

console.log("[DEBUG] Memory View:", memory);
