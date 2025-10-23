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
	return Object.keys(this.registers).includes(register);
    }
    
    static is_segment(register) {
	return register.split("_")[0] == "seg";
    }
}

class Emulator {
    static register_immediate_map = {reg0_low: 0xB0, reg2_low: 0xB1, reg3_low: 0xB2, reg1_low: 0xB3,
				     reg0_high: 0xB4, reg2_high: 0xB5, reg3_high: 0xB6, reg1_high: 0xB7,
				     reg0: 0xB8, reg2: 0xB9, reg3: 0xBA, reg1: 0xBB,
				     sp: 0xBC, bp: 0xBD, si: 0xBE, di: 0xBF};

    static register_register_map = {
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

    static segment_register_map = {
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

    static write_disk(hex) {
	disk[disk_ptr++] = hex;
    }

    static to_little_endian(hex) {
	const buffer = new ArrayBuffer(2);
	const view = new DataView(buffer);
	view.setUint16(0, hex, true);
	return new Uint8Array(buffer);
    }

    static str(register, value) {
	if (typeof value == "number") {
	    if (Register.is_segment(register)) {
		const error = "[ERROR] Cannot assign an immediate value to a segment register.";
		bios_content = bios_content + error;
		bios.value = bios_content;
		return;
	    }
	    this.write_disk(this.register_immediate_map[register]);
	    for (const hex of this.to_little_endian(value)) {
		this.write_disk(hex);
	    }
	} else if (Register.is_register(value) && !Register.is_segment(register)) {
	    this.write_disk(0x8B);
	    this.write_disk(this.register_register_map[register][value]);
	} else if (Register.is_register(value) && Register.is_segment(register)) {
	    this.write_disk(0x8C);
	    this.write_disk(this.segment_register_map[register][value]);
	} else if (!Register.is_register(value)) {
	    if (this.labels.has(value)) {
		this.write_disk(this.register_immediate_map[register]);
		for (const hex of this.to_little_endian(this.labels.get(value))) {
		    this.write_disk(hex);
		}
	    } else {
	      // TODO: Implment labels yet to be defined
	    }
	}
    }

    static pad(hex, times) {
	for (let i = 0; i < times; ++i) {
	    this.write_disk(hex);
	}
    }

    static hex(hex) {
	this.write_disk(hex);
    }

    static int(code) {
	this.write_disk(0xCD);
	for (const hex of this.to_little_endian(code)) {
	    this.write_disk(hex);
	}
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
		const register = this.get_register(Emulator.register_immediate_map, code[Register.ip]);
		const value_byte1 = code[++Register.ip];
		const value_byte2 = code[++Register.ip];
		const value = value_byte1 | (value_byte2 << 8);
		Register.set(register, value);
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

		const value = this.get_register(Emulator.register_register_map[register], next_byte);
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

		const value = this.get_register(Emulator.register_register_map[register], next_byte);
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

		const register = this.get_register(Emulator.segment_register_map[segment], next_byte);
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

// section code
Emulator.str("reg0", 1);
Emulator.str("seg_data", "reg0");
Emulator.str("seg_extra", "reg0");
Emulator.str("reg0_high", 0x0E);
Emulator.str("reg0_low", 'U'.charCodeAt());
Emulator.int(0x10);

Emulator.pad(0, 510 - (disk_ptr - org_adr));
Emulator.hex(0x55);
Emulator.hex(0xAA);
BIOS.load_master_boot_record();

console.log("[DEBUG] Memory View:", memory);
console.log("[DEBUG] Disk View:", disk);
