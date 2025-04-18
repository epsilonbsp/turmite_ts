import {rand_ex, wrap} from "@cl/math/math.ts";
import {vec3, vec3_t} from "@cl/math/vec3.ts";
import {COLOR_MODE, UT, gs_object, gui_bool, gui_button, gui_canvas, gui_collapsing_header, gui_color_edit, gui_input_number, gui_render, gui_render_table, gui_select, gui_slider_number, gui_text, gui_window, gui_window_grid, gui_window_layout, text_t, unit} from "@gui/gui.ts";
import {gl_init, gl_link_program} from "@engine/gl.ts";
import {DIRS, turmite_hash_vec, turmite_new, turmite_state, turmite_t} from "@engine/turmite.ts";
import {texture_new, texture_get_point, texture_set_point} from "@engine/texture.ts";
import {TURMITES} from "./specs.ts";

const root = gui_window(null);
gui_window_grid(
    root,
    [unit(300, UT.PX), unit(1, UT.FR), unit(300, UT.PX)],
    [unit(1, UT.FR), unit(1, UT.FR), unit(1, UT.FR)]
);

const left = gui_window(root);
const right = gui_window(root);
gui_window_layout(
    root,
    [
        left, right, right,
        left, right, right,
        left, right, right
    ]
);

const canvas = gui_canvas(right);

gui_render(root, document.body);

const canvas_el = canvas.canvas_el;
const gl = gl_init(canvas_el);

const program_main = gl_link_program({
    [gl.VERTEX_SHADER]: `#version 300 es
        layout(location = 0) in vec2 i_position;
        layout(location = 1) in vec2 i_tex_coord;
        out vec2 v_tex_coord;
        uniform float u_scale_x;
        uniform float u_scale_y;

        void main() {
            gl_Position = vec4(i_position * vec2(u_scale_x, u_scale_y), 0.0, 1.0);
            v_tex_coord = i_tex_coord;
        }
    `,
    [gl.FRAGMENT_SHADER]: `#version 300 es
        precision highp float;
        in vec2 v_tex_coord;
        out vec4 o_frag_color;
        uniform sampler2D u_texture;

        void main() {
            o_frag_color = texture(u_texture, v_tex_coord);
        }
    `
}) as WebGLProgram;

const u_scale_x = gl.getUniformLocation(program_main, "u_scale_x");
const u_scale_y = gl.getUniformLocation(program_main, "u_scale_y");

const vertices = [
    -1.0, 1.0, 0.0, 0.0,
    -1.0, -1.0, 0.0, 1.0,
    1.0, -1.0, 1.0, 1.0,
    1.0, 1.0, 1.0, 0.0
];

const indices = [
    0, 1, 2,
    0, 2, 3
];

const index_count = indices.length;

const vao = gl.createVertexArray();
gl.bindVertexArray(vao);

const vbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

gl.enableVertexAttribArray(0);
gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

gl.enableVertexAttribArray(1);
gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

const ibo = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);

const texture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, texture);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const config = {
    width: 512,
    height: 512,
    background_color: vec3(245, 171, 195),
    is_running: true,
    iterations: 0,
    ipf: 10,
    turmite: 0,
    rand_colors: 2,
    clear_on_spawn: false
};

let turmites: turmite_t[] = [];
let tex = texture_new(config.width, config.height);

function clear(color: vec3_t): void {
    if (tex.width !== config.width || tex.height !== config.height) {
        tex = texture_new(config.width, config.height);
    }

    turmites = [];

    for (let y = 0; y < tex.height; ++y) {
        for (let x = 0; x < tex.width; ++x) {
            texture_set_point(tex, x, y, color);
        }
    }
}

function spawn(preset: any): void {
    const table = {};
    const colors = [config.background_color];

    for (let i = 1; i < preset.colors; i += 1) {
        colors.push(vec3(rand_ex(0, 256), rand_ex(0, 256), rand_ex(0, 256)));
    }

    for (const state of preset.table) {
        turmite_state(table, state[0], colors[state[1]], state[2], colors[state[3]], state[4]);
    }

    turmites.push(
        turmite_new(rand_ex(0, tex.width), rand_ex(0, tex.height), 0, 0, table)
    );
}

function generate_random_preset(): any {
    const colors = config.rand_colors;
    const table = [];

    for (let i = 0; i < colors; i += 1) {
        table.push([
            0, i, 0, (i + 1) % colors, rand_ex(-4, 4)
        ]);
    }

    return {
        name: "Untitled",
        colors,
        table
    }
}

function print_spec(spec: any): void {
    console.log(JSON.stringify(spec));
}

const general = gui_collapsing_header(left, "Texture");

gui_input_number(general, "Width", gs_object(config, "width"), 1, 128, 1024);
gui_input_number(general, "Height", gs_object(config, "height"), 1, 128, 1024);
gui_color_edit(general, "Background Color", COLOR_MODE.R_0_255, config.background_color);

gui_button(general, "Clear", function(): void {
    clear(config.background_color);
});

const controls = gui_collapsing_header(left, "Controls");

gui_bool(controls, "Is Running", gs_object(config, "is_running"));

gui_slider_number(controls, "Iteration multiplier", gs_object(config, "ipf"), 1, 1, 100);

const header = ["state", "color", "next_state", "next_color", "turn"];

const preset = gui_collapsing_header(left, "Preset");

let text: text_t;

gui_select(preset, "Turmite", gs_object(config, "turmite"), TURMITES.map(row => row.name), Object.keys(TURMITES).map(row => parseInt(row)), function(index: number) {
    text.ref_el.innerHTML = "";
    text.ref_el.append(gui_render_table(TURMITES[index].table, header));
});

gui_text(preset, "Specification");

text = gui_text(preset, "");

gui_button(preset, "Spawn", function(): void {
    spawn(TURMITES[config.turmite]);
});

const rand_tab = gui_collapsing_header(left, "Random");


let text2: text_t;

gui_slider_number(rand_tab, "Colors", gs_object(config, "rand_colors"), 1, 2, 32);

gui_bool(rand_tab, "Clear On Spawn", gs_object(config, "clear_on_spawn"));

gui_button(rand_tab, "Spawn", function(): void {
    const preset = generate_random_preset();
    print_spec(preset);

    text2.ref_el.innerHTML = "";
    text2.ref_el.append(gui_render_table(preset.table, header));

    if (config.clear_on_spawn) {
        clear(config.background_color);
    }

    spawn(preset);
});

gui_text(rand_tab, "Specification");
text2 = gui_text(rand_tab, "None");

gui_render(left, root.container(), false);

text.ref_el.append(gui_render_table(TURMITES[config.turmite].table, header));

clear(config.background_color);

setInterval(() => {
    if (config.is_running) {
        for (let i = 0; i < config.ipf * 10; i += 1) {
            for (const ant of turmites) {
                const color = texture_get_point(tex, ant.x, ant.y);
                const state = ant.table[turmite_hash_vec(ant.state, color)];

                if (state) {
                    texture_set_point(tex, ant.x, ant.y, state.next_color);
                    ant.dir = wrap(ant.dir + state.turn, DIRS.length);
                    ant.state = state.next_state;
                }

                const dir = DIRS[ant.dir];
                ant.x = wrap(ant.x + dir[0], tex.width);
                ant.y = wrap(ant.y + dir[1], tex.height);
            }
        }
    }
}, 1000.0 / 30.0);

function render(): void {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, tex.width, tex.height, 0, gl.RGB, gl.UNSIGNED_BYTE, tex.data);

    gl.viewport(0, 0, canvas_el.width, canvas_el.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program_main);

    const canvas_size = Math.min(canvas_el.width, canvas_el.height);
    gl.uniform1f(u_scale_x, canvas_size / canvas_el.width);
    gl.uniform1f(u_scale_y, canvas_size / canvas_el.height);

    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, index_count, gl.UNSIGNED_INT, 0);
}

function loop(): void {
    render();

    requestAnimationFrame(loop);
}

loop();
