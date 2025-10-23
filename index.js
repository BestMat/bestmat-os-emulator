const memory = [];
const disk = [];
let disk_ptr = 0x7C00;
const os = document.getElementById("os");
const bios = document.getElementById("bios");
const factor = 40;
let bios_content = "";
const org_adr = disk_ptr;
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
			sp: 0, bp: 0, si: 0, di: 0, if_flag: 1, ip: 0,
			seg_code: 0, seg_data: 0, seg_extra: 0, seg_stack: 0};

    static ip = this.registers.ip;

    static get(register) {
	let value = this.registers[register];
	if (register.includes("_") && !register.includes("flag") && !register.includes("seg")) {
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
	
	if (register.includes("_") && !register.includes("flag") && !register.includes("seg")) {
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

	if (typeof value == "string" && this.is_register(value)) {
	    this.registers[register] = this.get(value);
	    return;
	}

	this.registers[register] = value;
    }

    static is_register(register) {
	return Object.keys(this.registers).includes(register) || Object.keys(this.registers).includes(register.split("_")[0]);
    }

    static is_8_bit_register(register) {
	const reg_split = register.split("_");
	return Object.keys(this.registers).includes(reg_split[0]) && (reg_split[1] === "high" || reg_split[1] === "low");
    }
    
    static is_segment(register) {
	return register.split("_")[0] == "seg";
    }
}

function little_endian(bytes, number) {
    const buffer = new ArrayBuffer(bytes);
    const data_view = new DataView(buffer);

    if (bytes === 2)
	data_view.setUint16(0, number, true);
    else
	data_view.setUint32(0, number, true);

    return new Uint8Array(buffer);
}

const segment_register_map = {
    seg_extra: {
	reg0: 0xC0,
	reg2: 0xC1,
	reg3: 0xC2,
	reg1: 0xC3,
	sp: 0xC4,
	bp: 0xC5,
	si: 0xC6,
	di: 0xC7
    },
    seg_code: {
	reg0: 0xC8,
	reg2: 0xC9,
	reg3: 0xCA,
	reg1: 0xCB,
	sp: 0xCC,
	bp: 0xCD,
	si: 0xCE,
	di: 0xCF
    },
    seg_stack: {
	reg0: 0xD0,
	reg2: 0xD1,
	reg3: 0xD2,
	reg1: 0xD3,
	sp: 0xD4,
	bp: 0xD5,
	si: 0xD6,
	di: 0xD7
    },
    seg_data: {
	reg0: 0xD8,
	reg2: 0xD9,
	reg3: 0xDA,
	reg1: 0xDB,
	sp: 0xDC,
	bp: 0xDD,
	si: 0xDE,
	di: 0xDF
    }
};

const register_register_map = {
    reg0: {
	reg0: 0xC0, reg0_low: 0xC0,
	reg2: 0xC1, reg2_low: 0xC1,
	reg3: 0xC2, reg3_low: 0xC2,
	reg1: 0xC3, reg1_low: 0xC3,
	sp: 0xC4,   reg0_high: 0xC4,
	bp: 0xC5,   reg2_high: 0xC5,
	si: 0xC6,   reg3_high: 0xC6,
	di: 0xC7,   reg1_high: 0xC7
    },
    reg0_low: {
	reg0: 0xC0, reg0_low: 0xC0,
	reg2: 0xC1, reg2_low: 0xC1,
	reg3: 0xC2, reg3_low: 0xC2,
	reg1: 0xC3, reg1_low: 0xC3,
	sp: 0xC4,   reg0_high: 0xC4,
	bp: 0xC5,   reg2_high: 0xC5,
	si: 0xC6,   reg3_high: 0xC6,
	di: 0xC7,   reg1_high: 0xC7
    },
    reg2: {
	reg0: 0xC8, reg0_low: 0xC8,
	reg2: 0xC9, reg2_low: 0xC9,
	reg3: 0xCA, reg3_low: 0xCA,
	reg1: 0xCB, reg1_low: 0xCB,
	sp: 0xCC,   reg0_high: 0xCC,
	bp: 0xCD,   reg2_high: 0xCD,
	si: 0xCE,   reg3_high: 0xCE,
	di: 0xCF,   reg1_high: 0xCF
    },
    reg2_low: {
	reg0: 0xC8, reg0_low: 0xC8,
	reg2: 0xC9, reg2_low: 0xC9,
	reg3: 0xCA, reg3_low: 0xCA,
	reg1: 0xCB, reg1_low: 0xCB,
	sp: 0xCC,   reg0_high: 0xCC,
	bp: 0xCD,   reg2_high: 0xCD,
	si: 0xCE,   reg3_high: 0xCE,
	di: 0xCF,   reg1_high: 0xCF
    },
    reg3: {
	reg0: 0xD0, reg0_low: 0xD0,
	reg2: 0xD1, reg2_low: 0xD1,
	reg3: 0xD2, reg3_low: 0xD2,
	reg1: 0xD3, reg1_low: 0xD3,
	sp: 0xD4,   reg0_high: 0xD4,
	bp: 0xD5,   reg2_high: 0xD5,
	si: 0xD6,   reg3_high: 0xD6,
	di: 0xD7,   reg1_high: 0xD7
    },
    reg3_low: {
	reg0: 0xD0, reg0_low: 0xD0,
	reg2: 0xD1, reg2_low: 0xD1,
	reg3: 0xD2, reg3_low: 0xD2,
	reg1: 0xD3, reg1_low: 0xD3,
	sp: 0xD4,   reg0_high: 0xD4,
	bp: 0xD5,   reg2_high: 0xD5,
	si: 0xD6,   reg3_high: 0xD6,
	di: 0xD7,   reg1_high: 0xD7
    },
    reg1: {
	reg0: 0xD8, reg0_low: 0xD8,
	reg2: 0xD9, reg2_low: 0xD9,
	reg3: 0xDA, reg3_low: 0xDA,
	reg1: 0xDB, reg1_low: 0xDB,
	sp: 0xDC,   reg0_high: 0xCC,
	bp: 0xDD,   reg2_high: 0xDD,
	si: 0xDE,   reg3_high: 0xDE,
	di: 0xDF,   reg1_high: 0xDF
    },
    reg1_low: {
	reg0: 0xD8, reg0_low: 0xD8,
	reg2: 0xD9, reg2_low: 0xD9,
	reg3: 0xDA, reg3_low: 0xDA,
	reg1: 0xDB, reg1_low: 0xDB,
	sp: 0xDC,   reg0_high: 0xCC,
	bp: 0xDD,   reg2_high: 0xDD,
	si: 0xDE,   reg3_high: 0xDE,
	di: 0xDF,   reg1_high: 0xDF
    },
    sp: {
	reg0: 0xE0, reg0_low: 0xE0,
	reg2: 0xE1, reg2_low: 0xE1,
	reg3: 0xE2, reg3_low: 0xE2,
	reg1: 0xE3, reg1_low: 0xE3,
	sp: 0xE4,   reg0_high: 0xE4,
	bp: 0xE5,   reg2_high: 0xE5,
	si: 0xE6,   reg3_high: 0xE6,
	di: 0xE7,   reg1_high: 0xE7
    },
    reg0_high: {
	reg0: 0xE0, reg0_low: 0xE0,
	reg2: 0xE1, reg2_low: 0xE1,
	reg3: 0xE2, reg3_low: 0xE2,
	reg1: 0xE3, reg1_low: 0xE3,
	sp: 0xE4,   reg0_high: 0xE4,
	bp: 0xE5,   reg2_high: 0xE5,
	si: 0xE6,   reg3_high: 0xE6,
	di: 0xE7,   reg1_high: 0xE7
    },
    bp: {
	reg0: 0xE8, reg0_low: 0xE8,
	reg2: 0xE9, reg2_low: 0xE9,
	reg3: 0xEA, reg3_low: 0xEA,
	reg1: 0xEB, reg1_low: 0xEB,
	sp: 0xEC,   reg0_high: 0xEC,
	bp: 0xED,   reg2_high: 0xED,
	si: 0xEE,   reg3_high: 0xEE,
	di: 0xEF,   reg1_high: 0xEF
    },
    reg2_high: {
	reg0: 0xE8, reg0_low: 0xE8,
	reg2: 0xE9, reg2_low: 0xE9,
	reg3: 0xEA, reg3_low: 0xEA,
	reg1: 0xEB, reg1_low: 0xEB,
	sp: 0xEC,   reg0_high: 0xEC,
	bp: 0xED,   reg2_high: 0xED,
	si: 0xEE,   reg3_high: 0xEE,
	di: 0xEF,   reg1_high: 0xEF
    },
    si: {
	reg0: 0xF0, reg0_low: 0xF0,
	reg2: 0xF1, reg2_low: 0xF1,
	reg3: 0xF2, reg3_low: 0xF2,
	reg1: 0xF3, reg1_low: 0xF3,
	sp: 0xF4,   reg0_high: 0xF4,
	bp: 0xF5,   reg2_high: 0xF5,
	si: 0xF6,   reg3_high: 0xF6,
	di: 0xF7,   reg1_high: 0xF7
    },
    reg3_high: {
	reg0: 0xF0, reg0_low: 0xF0,
	reg2: 0xF1, reg2_low: 0xF1,
	reg3: 0xF2, reg3_low: 0xF2,
	reg1: 0xF3, reg1_low: 0xF3,
	sp: 0xF4,   reg0_high: 0xF4,
	bp: 0xF5,   reg2_high: 0xF5,
	si: 0xF6,   reg3_high: 0xF6,
	di: 0xF7,   reg1_high: 0xF7
    },
    di: {
	reg0: 0xF8, reg0_low: 0xF8,
	reg2: 0xF9, reg2_low: 0xF9,
	reg3: 0xFA, reg3_low: 0xFA,
	reg1: 0xFB, reg1_low: 0xFB,
	sp: 0xFC,   reg0_high: 0xFC,
	bp: 0xFD,   reg2_high: 0xFD,
	si: 0xFE,   reg3_high: 0xFE,
	di: 0xFF,   reg1_high: 0xFF
    },
    reg1_high: {
	reg0: 0xF8, reg0_low: 0xF8,
	reg2: 0xF9, reg2_low: 0xF9,
	reg3: 0xFA, reg3_low: 0xFA,
	reg1: 0xFB, reg1_low: 0xFB,
	sp: 0xFC,   reg0_high: 0xFC,
	bp: 0xFD,   reg2_high: 0xFD,
	si: 0xFE,   reg3_high: 0xFE,
	di: 0xFF,   reg1_high: 0xFF
    }
};

const register_immediate_map = {reg0_low: 0xB0, reg2_low: 0xB1, reg3_low: 0xB2, reg1_low: 0xB3,
				 reg0_high: 0xB4, reg2_high: 0xB5, reg3_high: 0xB6, reg1_high: 0xB7,
				 reg0: 0xB8, reg2: 0xB9, reg3: 0xBA, reg1: 0xBB,
				 sp: 0xBC, bp: 0xBD, si: 0xBE, di: 0xBF};

class Assembler {
    static bytecode = new Array();
    static bytecode_ptr = this.bytecode.length;
    static scan_ptr = 0;
    static labels = new Map();
    static data = new Map();

    static write_byte(byte) {
	if (typeof byte === "object") {
	    for (const b of byte) {
		this.bytecode[this.bytecode_ptr] = b;
		this.bytecode_ptr += 1;
	    }
	    return;
	}
	
	this.bytecode[this.bytecode_ptr] = byte;
	this.bytecode_ptr += 1;
    }

    static write_disk() {
	for (const byte of this.bytecode) {
	    disk[disk_ptr] = byte;
	    disk_ptr += 1;
	}
    }

    static add_data(mode, ident, value) {
	if (mode === "scan") {
	    this.data.set(ident, { value: undefined, ptr: this.scan_ptr });
	    this.scan_ptr += value.length;
	    return;
	}
	this._assert(
	    this.data.get(ident).ptr === this.bytecode_ptr,
	    this.data.get(ident).ptr.toString() + " does not match with " + ident + "'s pointer " + this.bytecode_ptr.toString 
	);
	this.data.set(ident, { value, ptr: this.bytecode_ptr });
	for (const char of value) this.write_byte(char.charCodeAt());
    }

    static compile(insts) {
	for (const inst of insts) {
	    this.compile_inst("scan", inst[0], inst.slice(1, inst.length));
	    console.log("[DEBUG] Scan Pointer: 0x0" + this.scan_ptr.toString(16) + " (" + this.scan_ptr.toString() + ")");
	}
	console.table("[DEBUG] Label Table:", this.labels);
	console.table("[DEBUG] Data Table:", this.data);

	for (const inst of insts) {
	    this.compile_inst("compile", inst[0], inst.slice(1, inst.length));
	}
	this.write_disk();
    }

    static compile_inst(mode, op, op_args) {
	this._assert(mode === "compile" || mode === "scan", String(mode) + " is not a valid mode");
	if (op === "str") {
	    const register = op_args[0];
	    const value = op_args[1];
	    this._assert(Register.is_register(register), String(register) + " is not a valid register");

	    if (typeof value === "string" && Register.is_register(value)) {
		if (Register.is_segment(register)) { // segment <- register
		    this.compile_str_segment_register(mode, register, value);
		    return;
		}

		this.compile_str_register_register(mode, register, value);
		return;
	    } else if (!isNaN(Number(value))) {
		this._assert(!Register.is_segment(register), register + " cannot be assigned an immediate value");
		this.compile_str_register_immediate(mode, register, value);
	    } else if (this.data.has(value)) {
		this.compile_str_register_data(mode, register, value);
	    } else {
		this._error("invalid value \"" + String(value) + "\" found during str instruction compilation");
	    }
	} else if (op === "int") {
	    const code = op_args[0];
	    this.compile_int(mode, code);
	} else if (op === "hex") {
	    const code = op_args[0];
	    this.compile_hex(mode, code);
	} else if (op === "pad") {
	    const amt = op_args[0];
	    this.compile_pad(mode, amt);
	} else if (op === "label") {
	    const name = op_args[0];
	    this.compile_label(mode, name);
	} else if (op === "data") {
	    const name = op_args[0];
	    const data = op_args[1];
	    this.add_data(mode, name, data);
	}
    }

    // inst: str <segment_register>, <general_purpose_register>
    // e.g.: str seg_data, reg0
    static compile_str_segment_register(mode, segment, register) {
	if (mode === "scan") { this.scan_ptr += 2; return; }
	this.write_byte(0x8C);
	this.write_byte(segment_register_map[segment][register]);
    }

    // inst: str <general_purpose_register>, <general_purpose_register>
    // e.g.: str reg0, reg1
    static compile_str_register_register(mode, register1, register2) {
	if (mode === "scan") { this.scan_ptr += 2; return; }
	this.write_byte(0x8B);
	this.write_byte(register_register_map[register1][register2]);
    }

    // inst: str <general_purpose_register>, <immediate_value>
    // e.g.: str reg0, 27
    static compile_str_register_immediate(mode, register, value) {
	const little_endian_hex = Register.is_8_bit_register(register)
	      ? [ little_endian(2, value)[0] ]
	      : little_endian(2, value);
	if (mode === "scan") { this.scan_ptr += 1 + little_endian_hex.length; return; }
	this.write_byte(register_immediate_map[register]);
	this.write_byte(little_endian_hex);
    }

    // inst: str <general_purpose_register>, <data>
    // e.g.: str reg0, str (section data: str = "Hello, World!\n\0")
    static compile_str_register_data(mode, register, value) {
	const little_endian_hex = little_endian(2, this.data.get(value).ptr);
	if (mode === "scan") { this.scan_ptr += 1 + little_endian_hex.length; return; }
	this.write_byte(register_immediate_map[register]);
	this.write_byte(little_endian_hex);
    }

    // inst: int <code>
    // e.g.: int 0x10
    static compile_int(mode, code) {
	if (mode === "scan") { this.scan_ptr += 2; return; }
	this.write_byte(0xCD);
	this.write_byte(code);
    }

    // inst: hex <code>
    // e.g.: hex 0xAA55
    static compile_hex(mode, code) {
	const little_endian_hex = little_endian(2, code);
	if (mode === "scan") { this.scan_ptr += little_endian_hex.length; return; }
	this.write_byte(little_endian_hex);
    }

    // inst: pad <amt> 
    // e.g.: pad 510
    static compile_pad(mode, amt) {
	if (mode === "scan") { this.scan_ptr += amt - this.scan_ptr; return; }
	const pad_amt = amt - this.bytecode_ptr;
	for (let i = 0; i < pad_amt; ++i) {
	    this.write_byte(0);
	}
    }

    // inst: label <name>
    // e.g.: label _start
    static compile_label(mode, name) {
	if (mode === "scan") {
	    this.labels.set(name, this.scan_ptr);
	    return;
	}
	const error = "Pointer of label " +
	      name + " - " + this.labels.get(name).toString() +
	      " does not match " + this.bytecode_ptr.toString();
	this._assert(this.labels.get(name) === this.bytecode_ptr, error);
    }

    static _assert(expr, str) {
	if (expr === true) return;
	if (bios.hidden === false) {
	    const error = "[ASSEMBLER] Assertion failed: " + str + ".";
	    bios_content = bios_content + error;
	    throw new Error(error);
	} else {
	    const error = "[ASSEMBLER] Assertion failed: " + str + ".";
	    // assert to kernel
	    throw new Error(error);
	}
	return;
    }

    static _error(str) {
	if (bios.hidden === false) {
	    const error = "[ASSEMBLER] Error: " + str + ".";
	    bios_content = bios_content + error;
	    throw new Error(error);
	} else {
	    const error = "[ASSEMBLER] Error: " + str + ".";
	    // assert to kernel
	    throw new Error(error);
	}
	return;
    }
}

class BIOS {
    static get_register(map, hex) {
	return Object.keys(map).find(key => map[key] === hex);
    }

    static interrupt(code) {
	if (Register.get("if_flag") == 0) return;

	const high = Register.get("reg0_high");
	const low = Register.get("reg0_low");
	if (code == 0x10) {
	    if (high == 0x0E) {
		// TODO: Implement page_number and foreground_color
		const page_number = Register.get("reg1_high");
		const foreground_color = Register.get("reg1_low");
		if (low == 10) {
		    bios_content = bios_content + '\n';
		    bios.value = bios_content;
		    return;
		}
		
		bios_content = bios_content + String.fromCharCode(low);
		bios.value = bios_content;
	    }
	}
    }
    
    static emulate_bootloader(code) {
	while (Register.ip < code.length) {
	    const inst = code[Register.ip];
	    if (inst >= 0xB0 && inst <= 0xBF) { // str: store register, immediate value
		const register = this.get_register(register_immediate_map, code[Register.ip]);

		if (Register.is_8_bit_register(register)) {
		    const value = code[++Register.ip];
		    Register.set(register, value);
		} else {
		    const value_byte1 = code[++Register.ip];
		    const value_byte2 = code[++Register.ip];
		    const value = value_byte1 | (value_byte2 << 8);
		    Register.set(register, value);
		}
	    } else if (inst == 0x8A) { // str: store register, register (8-bit)
		const next_byte = code[++Register.ip];
		let register = undefined;
		if (next_byte >= 0xC0 && next_byte <= 0xC7) {
		    register = "reg0_low";
		} else if (next_byte >= 0xC8 && next_byte <= 0xCF) {
		    register = "reg2_low";
		} else if (next_byte >= 0xD0 && next_byte <= 0xD7) {
		    register = "reg3_low";
		} else if (next_byte >= 0xD8 && next_byte <= 0xDF) {
		    register = "reg1_low";
		} else if (next_byte >= 0xE0 && next_byte <= 0xE7) {
		    register = "reg0_high";
		} else if (next_byte >= 0xE8 && next_byte <= 0xEF) {
		    register = "reg2_high";
		} else if (next_byte >= 0xF0 && next_byte <= 0xF7) {
		    register = "reg3_high";
		} else if (next_byte >= 0xF8 && next_byte <= 0xFF) {
		    register = "reg1_high";
		} else {
		    const error = "[ERROR] Invalid byte " + String(next_byte) + " found in source.\n";
		    bios_content = bios_content + error;
		    bios.value = bios_content;
		    return;
		}

		const value = this.get_register(register_register_map[register], next_byte);
		Register.set(register, value);
	    } else if (inst == 0x8B) { // str: store register, register (16-bit)
		const next_byte = code[++Register.ip];
		let register = undefined;
		if (next_byte >= 0xC0 && next_byte <= 0xC7) {
		    register = "reg0";
		} else if (next_byte >= 0xC8 && next_byte <= 0xCF) {
		    register = "reg2";
		} else if (next_byte >= 0xD0 && next_byte <= 0xD7) {
		    register = "reg3";
		} else if (next_byte >= 0xD8 && next_byte <= 0xDF) {
		    register = "reg1";
		} else if (next_byte >= 0xE0 && next_byte <= 0xE7) {
		    register = "sp";
		} else if (next_byte >= 0xE8 && next_byte <= 0xEF) {
		    register = "bp";
		} else if (next_byte >= 0xF0 && next_byte <= 0xF7) {
		    register = "si";
		} else if (next_byte >= 0xF8 && next_byte <= 0xFF) {
		    register = "di";
		} else {
		    const error = "[ERROR] Invalid byte " + String(next_byte) + " found in source.\n";
		    bios_content = bios_content + error;
		    bios.value = bios_content;
		    return;
		}

		const value = this.get_register(register_register_map[register], next_byte);
		Register.set(register, value);
	    } else if (inst == 0x8C) { // str: store segment, register (16-bit)
		const next_byte = code[++Register.ip];
		let segment = undefined;

		if (next_byte >= 0xC0 && next_byte <= 0xC7) {
		    segment = "seg_extra";
		} else if (next_byte >= 0xC8 && next_byte <= 0xCF) {
		    segment = "seg_code";
		} else if (next_byte >= 0xD0 && next_byte <= 0xD7) {
		    segment = "seg_stack";
		} else if (next_byte >= 0xD8 && next_byte <= 0xDF) {
		    segment = "seg_data";
		} else {
		    const error = "[ERROR] Invalid byte " + String(next_byte) + " found in source.\n";
		    bios_content = bios_content + error;
		    bios.value = bios_content;
		    return;
		}

		const register = this.get_register(segment_register_map[segment], next_byte);
		Register.set(segment, register);
	    } else if (inst == 0xCD) { // int: BIOS interrupts
		const interrupt_code = code[++Register.ip];
		this.interrupt(interrupt_code);
	    }

	    Register.ip += 1;
	}
    }
    
    static load_master_boot_record() {
	if (disk.length - org_adr != 512) {
	    bios_content = bios_content + "[ERROR] Failed to read boot sector of disk.\n";
	    bios_content = bios_content + "[ERROR] Expected boot sector length to be 512 bytes.\n";
	    bios.value = bios_content;
	    return;
	}

	const boot_signature = disk.slice(org_adr + 510, org_adr + 512);
	if (boot_signature[0] == 0x55 && boot_signature[1] == 0xAA) {
	    const bootloader_code = disk.slice(org_adr + 0, org_adr + 440); 
	    this.emulate_bootloader(bootloader_code);
	} else {
	    bios_content = bios_content + "[ERROR] Cannot find bootloader.\n";
	    bios_content = bios_content + "[ERROR] Make sure boot signature is 0xAA55.\n";
	    bios.value = bios_content;
	    return;
	}
    }
}

const insts = [
    ["data", "string", "Hello World!\n\0"],
    ["label", "_start"],
    ["str", "reg0", 0],
    ["str", "seg_data", "reg0"],
    ["str", "seg_extra", "reg0"],
    ["str", "reg0_high", 0x0E],
    ["str", "reg0_low", 'U'.charCodeAt()],
    ["int", 0x10],
    ["str", "si", "string"],
    ["pad", 510],
    ["hex", 0xAA55]
];

Assembler.compile(insts);
BIOS.load_master_boot_record();

console.log("[DEBUG] Memory View:", memory);
console.log("[DEBUG] Disk View:", disk);
