import input from 'boredjs/input'
import audio from 'boredjs/audio'
import util from 'boredjs/util'
import game from 'boredjs/game'
import geometry from 'boredjs/geometry'
import entity from 'boredjs/entity'
import physics from 'boredjs/physics'

let right_to_left = false;

let default_style = {
    fontSize: 10,
    font: "'Roboto Mono', monospace",
    lineStyles: 'white black 1.0 round round',
    fillStyle: 'rgba(26,47,158,0.5)'
};

let wordWrapText = function(text, width, style, context) {
    let wordWrapLine = function(line) {
        let word_delimeter = ' ';
        let words = line.split(word_delimeter);
        let lines = [];
        let current_line = '';
        for (let i = 0; i < words.length; i++) {
            let word = words[i];
            let current_line_candidate = i === 0 ? word : current_line + word_delimeter + word;
            if ((context.measureText(current_line_candidate)).width > width) {
                lines.push(current_line);
                current_line = word;
            } else {
                current_line = current_line_candidate;
            }
        }
        if (current_line !== '') { lines.push(current_line); }
        return lines;
    };
    let line_delimeter = '\n';
    style = style || default_style;
    context = context || game.canvas().getContext('2d');
    context.save();
    context.font = style.fontSize + 'px ' + style.font;
    let lines = [].concat(...(text.split(line_delimeter)).map(wordWrapLine));
    context.restore();
    return lines;
};

let drawTextBox = function(x, y, width, height, lines_scrolled, text_obj, style, context) {
    style = style || default_style;
    context = context || game.canvas().getContext('2d');

    context.save();

    context.font = style.fontSize + 'px ' + style.font;
    context.textBaseline = "top";

    let styleDescriptors = style.lineStyles.split(' ');
    let mainLineStrokeStyle = styleDescriptors[0];
    context.strokeStyle = styleDescriptors[1];
    context.lineWidth = styleDescriptors[2];
    context.lineCap = styleDescriptors[3];
    context.lineJoin = styleDescriptors[4];
    context.fillStyle = style.fillStyle;

    context.fillRect(x + 1.0, y + 1.0, width - 2.0, height - 2.0);
    context.strokeRect(x + 1.5, y + 1.5, width - 2.0, height - 2.0);
    context.strokeStyle = mainLineStrokeStyle;
    context.strokeRect(x + 0.5, y + 0.5, width - 2.0, height - 2.0);

    context.beginPath();
    context.rect(x + 2.0, y + 2.0, width - 4.0, height - 4.0);
    context.clip();
    context.fillStyle = mainLineStrokeStyle;
    context.textAlign = 'start';
    for (let i = 0; i < text_obj.lines.length; i++) {
        let line = text_obj.lines[i];
        if (right_to_left) {
            context.fillText(line, x + width - 3.0, y + 3.0 + (i-lines_scrolled)*text_obj.spacing);
        } else {
            context.fillText(line, x + 3.0, y + 3.0 + (i-lines_scrolled)*text_obj.spacing);
        }
    }

    context.restore();
};

export default {
    isRightToLeft() { return right_to_left; },

    textBoxDialog(text, conf) {
        let {x, y, width, height, speed, style, context, callback} = conf;
        if(width == null) width = game.width();
        if(height == null) height = Math.trunc(game.height() * .30);
        if(x == null) x = 0;
        if(y == null) y = game.height() - height;
        if(speed == null) speed = 16;
        
        game.state = 'dialog';
        style = style || default_style;
        context = context || game.canvas().getContext('2d');
        let line_progress = 0.0,
            lines_scrolled = 0.0,
            num_lines_per_screen = ((height - 6.0) / style.fontSize) | 0,
            cur_line_idx = 0,
            cur_line = '',
            word_wrapped_text = wordWrapText(text, width-6, style, context),
            displayed_text = [],
            done = false,
            new_line_progress;

        let updateGenerator = function*() {
            while (cur_line_idx < word_wrapped_text.length) {
                let dt = yield undefined,
                    delta = dt * speed * (input.pointer.state ? 3.0 : 1.0);
                if (lines_scrolled >= cur_line_idx - num_lines_per_screen + 1) {
                    new_line_progress = line_progress + delta;
                } else {
                    lines_scrolled = Math.min(cur_line_idx - num_lines_per_screen + 1, lines_scrolled + delta);
                }
                if (new_line_progress | 0 > line_progress | 0) {
                    if (new_line_progress >= word_wrapped_text[cur_line_idx].length) {
                        cur_line_idx++;
                        cur_line = '';
                        line_progress = 0.0;
                        new_line_progress = 0.0;
                        displayed_text = word_wrapped_text.slice(0, cur_line_idx);
                    } else {
                        cur_line = word_wrapped_text[cur_line_idx].slice(0, (new_line_progress | 0)).trim();
                    }

                    displayed_text[cur_line_idx] = cur_line;
                }
                line_progress = new_line_progress;
            }
            // if(input.debug.pressed) {
            //     console.log({
            //         num_lines_per_screen: num_lines_per_screen,
            //         line_progress: line_progress,
            //         lines_scrolled: lines_scrolled,
            //         cur_line_idx: cur_line_idx,
            //         cur_line: cur_line,
            //         word_wrapped_text: word_wrapped_text,
            //         displayed_text: displayed_text
            //     });
            // }
            displayed_text = word_wrapped_text;
            while (!input.pointer.pressed) { let dt = yield undefined; }
            done = true;
            if (callback != null) { return callback(); }
        };
        let drawGenerator = function*() {
            return yield* (function*() { let result = []; while (!done) {
                context = yield undefined;
                result.push(drawTextBox(x, y, width, height, lines_scrolled, {
                        spacing: style.fontSize,
                        lines: displayed_text
                    }, style, context));
            } return result; }).call(this);
        };

        return game.invoke(util.prepareCoroutineSet(updateGenerator, drawGenerator));
    }
};
