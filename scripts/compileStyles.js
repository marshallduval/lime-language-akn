/*
 * Copyright (c) 2014 - Copyright holders CIRSFID and Department of
 * Computer Science and Engineering of the University of Bologna
 *
 * Authors:
 * Monica Palmirani – CIRSFID of the University of Bologna
 * Fabio Vitali – Department of Computer Science and Engineering of the University of Bologna
 * Luca Cervone – CIRSFID of the University of Bologna
 *
 * Permission is hereby granted to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The Software can be used by anyone for purposes without commercial gain,
 * including scientific, individual, and charity purposes. If it is used
 * for purposes having commercial gains, an agreement with the copyright
 * holders is required. The above copyright notice and this permission
 * notice shall be included in all copies or substantial portions of the
 * Software.
 *
 * Except as contained in this notice, the name(s) of the above copyright
 * holders and authors shall not be used in advertising or otherwise to
 * promote the sale, use or other dealings in this Software without prior
 * written authorization.
 *
 * The end-user documentation included with the redistribution, if any,
 * must include the following acknowledgment: "This product includes
 * software developed by University of Bologna (CIRSFID and Department of
 * Computer Science and Engineering) and its authors (Monica Palmirani,
 * Fabio Vitali, Luca Cervone)", in the same place and form as other
 * third-party acknowledgments. Alternatively, this acknowledgment may
 * appear in the software itself, in the same form and location as other
 * such third-party acknowledgments.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// Script for compiling LIME language plugin styles.
// Generates Sass code from JSON interface files and renders it to css.
// Execute with babel-node

import fs from 'fs';
import path from 'path';
import walk from 'walk';
import sass from 'node-sass';

const interfaceDir = path.join(__dirname, '../interface');
const stylesDir = path.join(__dirname, '../styles');
const sassTemplate = fs.readFileSync(path.join(stylesDir, 'akn_lang_template.scss'), 'utf8');

writeDefaultContentCss();
writeLangsContentCss();

function writeDefaultContentCss() {
    const sass = fs.readFileSync(path.join(stylesDir, 'content.scss'), 'utf8');
    writeCss(['default'], renderSass(sass));
}

function renderSass(data) {
    return sass.renderSync({
        data,
        outputStyle: 'compressed',
        includePaths: [stylesDir]
    }).css;
}

function writeCss(folders, css) {
    const outputFile = path.join(stylesDir, 'css', 'content_'+folders.join('_')+'.css');
    try {
        fs.writeFileSync(outputFile, css);
        console.info(`Written css ${outputFile}`);
    } catch(e) {
        console.error(e, outputFile);
    }
}

function writeLangsContentCss() {
    compilePluginStyle(interfaceDir, (customizations) => {
        customizations.forEach(customization => {
            const { folders, labels } = customization;
            const type = folders[0];
            const locale = folders.length === 3 ? folders[1] : '';
            const lang = folders[folders.length-1];
            const sassData = generateSass(type, locale, lang, labels);
            writeCss(folders, renderSass(sassData));
        });
    });
}

const markupManuConfig = [];
// This function builds a unique JSON file from a language plugin folder
function  compilePluginStyle(languageDir, cb) {
    const walker = walk.walk(languageDir, { followLinks: false });

    walker.on('file', function(root, fileStat, next) {
        let filePath = path.resolve(root, fileStat.name);
        if (fileStat.name === 'markupMenu.json') {
            fs.readFile(filePath, 'utf8', (err, data) => {
                addMarkupMenuConfig(filePath, JSON.parse(data));
                next();
            });
            next();
        } else {
            next();
        }
    });
    walker.on('end', function() {
        cb(markupManuConfig);
    });
}

function addMarkupMenuConfig(filePath, data) {
    let folders = path.dirname(path.relative(interfaceDir, filePath)).split(path.sep);
    let labels = getShortLabelsFromConfig(data);
    if (labels.length > 0) {
        markupManuConfig.push({ folders, labels });
    }
}

function getShortLabelsFromConfig(config) {
    const patterns = new Set(['inline', 'block', 'hcontainer', 'container', 'marker']);
    return Object.keys(config)
        .filter(key => {
            // Exclude labels for the generic elements with class e.g. 'container container'
            // because these labels will overwrite the label of container elements
            // such as premble, because the class will be 'container preamble'
            return !patterns.has(key) &&
                    (config[key].shortLabel || config[key].label);
        })
        .map(key => {
            var value = config[key].shortLabel || config[key].label;
            return { [key]: value };
        });
}

function generateSass(type, locale, lang, labels) {
    const templateSass = getCustomSass(lang) || sassTemplate;
    const sassLabels = labelsToSass(labels);

    type = type !== 'default' ? '.'+type : '';
    locale = locale ? '.'+locale : '';

    return templateSass
                .replace(
                    /#tinymce\.lime[^\{}]* {/,
                    `#tinymce.lime${type}${locale}.${lang} { ${sassLabels}`
                );;
}

function getCustomSass(lang) {
    const customSass = path.join(stylesDir, `akn_${lang}.scss`);
    if (fs.existsSync(customSass)) {
        return fs.readFileSync(customSass, 'utf8');
    }
}

function labelsToSass(labels) {
    return labels.map(obj => {
        let key = Object.keys(obj)[0];
        return `.${key} { @include Label('${obj[key]}') }`
    }).join('\n');
}