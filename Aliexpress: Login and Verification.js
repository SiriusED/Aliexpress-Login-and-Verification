// ==UserScript==
// @name         Aliexpress: Login and Verification - Public version
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Автоматический вход на Алиэкспресс с решением капчи + Автоматический слайдер, капча, телефон на верефикации
// @author       Andronio + (Sky edited)
// @match        https://login.aliexpress.com/*
// @match        https://login.aliexpress.ru/*
// @match        https://passport.aliexpress.com/ac/pc_r_open.htm?fromSite=13*
// @match        https://passport.aliexpress.com/ac/to_iv.htm?fromSite=13*
// @match        https://passport.aliexpress.com//newlogin/account/check.do/_____tmd_____/punish?*
// @grant        none
// @run-at       document-idle

// ==/UserScript==
(async function() {
    'use strict';

    /* Если пароль постоянный, то прописать */
    const alwaysPass = '';

    /* Автонажатие кнопки `Submit` после слайдера */
    const captchaAutoSubmit = true;

    /* Номер телефона - Смотрите что бы совпадал со страной, другие кейсы не тестировались.
     * Если оставить пустым то выполнение остановится перед вводом.
     */
    const phone = '0979999999';

    /* Страна для номера */
    const countryName = 'Ukraine';

    /*
    * Processing
    */
    if (window.location.href.startsWith('https://login.aliexpress.')) {
        await waitForElement('#fm-login-id', 250, 30)
        let login = document.getElementById('fm-login-id');
        let passw = document.getElementById('fm-login-password');
        login.addEventListener('paste', enterLoginHandler);
        passw.addEventListener('paste', enterLoginHandler);
        login.focus();

        async function enterLoginHandler(event) {
            let text = (event.clipboardData || window.clipboardData).getData('text').trim();
            let mass = [];
            if (alwaysPass.trim()) {
                if (/\w+@[\w\.-]+\.\w+/.test(text)) {
                    mass.push(text);
                    mass.push(alwaysPass.trim());
                } else mass = null;
            } else {
                mass = parseString(text);
            }
            if (mass) {
                event.preventDefault();
                let enterButton = document.querySelector('.fm-button');
                setInput(login, mass[0]);
                await sleep(200);
                let ready = await waitForElement('.fm-loading', 100, 30, true);
                if (!ready) return alert('Не дождался загрузки логина');
                setInput(passw, mass[1]);
                await sleep(500);
                ready = await waitForElement('.fm-loading', 100, 30, true);
                if (!ready) return alert('Не дождался загрузки слайдера');
                if (isPresent('#nc_1_n1z')) {

                    // Resolving slider
                    await solveSlider();
                    await sleep(500);
                    ready = await waitForElement('#nc-loading-circle', 100, 30, true);
                    if (!ready) return alert('Не дождался загрузки слайдера 2');
                    if (isPresent('#login-check-code .errloading')) location.reload();

                    // Resolving captcha
                    solveCaptcha();
                }
                enterButton.click();
            }
        }
    }

    if (window.location.href.startsWith('https://passport.aliexpress.com/ac/pc_r_open.htm?fromSite=13')) {
        await solveSlider();
    }

    if (window.location.href.startsWith('https://passport.aliexpress.com/ac/to_iv.htm?fromSite=13')) {
        await solvePhoneVerification();
    }


    async function solvePhoneVerification() {
        let ready = await waitForElement('#iframe1', 100, 10, false);
        if (!ready) return alert('Не дождался загрузки начальной страницы верефикации');
        let iframe = document.querySelector('#iframe1');
        iframe.addEventListener('load', async function(event) {
            let verifyButton = event.originalTarget.contentDocument.querySelector('.ui-button-text');
            if (!!verifyButton) verifyButton.click();

            let countrySelect = event.originalTarget.contentDocument.querySelector('#country');
            let phoneInput;
            if (!!countrySelect) {
                let optionsArr = Array.prototype.slice.call(countrySelect.options, 0);
                let index = optionsArr.findIndex(e => e.label == countryName);
                if (index < 0) return alert('Не нашел страну, проверьте правильно ли введено имя страны для дропдауна.');
                if (!!countrySelect) countrySelect.selectedIndex = index;
                phoneInput = event.originalTarget.contentDocument.querySelector('#J_Mobile');
            }

            /* Handling phone */
            if (!!phoneInput) {
                await sleep(2000);
                if (!!phone) {
                    try {
                        log('Using phone: ' + document.phone);
                        setInput(phoneInput, phone);
                        let submitPhoneButton = event.originalTarget.contentDocument.querySelector('input[type="submit"]');
                        if (!!submitPhoneButton) {
                            submitPhoneButton.click();
                        }
                    }
                    catch (e) {
                        log('Error on number entering: |setInput() => Error|');
                    }
                }
            }
        });

    }

    async function solveSlider() {
        //log('Working on Slider'); /* DEBUG */
        await waitForElement('#nc_1_n1z', 250, 30);
        const slider = document.getElementById('nc_1_n1z');
        const coord = slider.getBoundingClientRect();
        const field = document.getElementById('nc_1__scale_text');
        const fieldWidth = field.getBoundingClientRect();
        sendMouseEvent(coord.x + coord.height / 2, coord.y + coord.width / 2, slider, 'mousedown');
        await sleep(200);
        sendMouseEvent(coord.x + coord.height + fieldWidth.width, coord.y + coord.width / 2, slider, 'mousemove');
        solveCaptcha();
    }

    async function solveCaptcha() {
        // log('Working on Captcha'); /* DEBUG */
        let ready = await waitForElement('#nc_1__imgCaptcha_img', 100, 30, false);
        if (!ready) return alert("Не дождался загрузки капчи");
        let captcha = getCode();
        if (captcha === '----') {
            do {
                document.querySelector('#nc_1__imgCaptcha_img img').click();
                await sleep(1000);
                captcha = getCode();
            } while (captcha === '----');
        }
        const captchaInput = document.getElementById('nc_1_captcha_input');
        setInput(captchaInput, captcha);
        await sleep(200);
        document.getElementById('nc_1_scale_submit').click();

        // Wrong captcha
        ready = await waitForElement('#nc_1_scale_submit', 100, 5, true);
        if (!ready) return alert("Не дождался появления кнопки вход");

        if (captchaAutoSubmit) {
            let enterButton = document.querySelector("#submitBtn");
            enterButton.click();
        }
    }

    async function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };

    function setInput(input, value) {
        if (!input) {
            return;
        }

        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, value);
        input.dispatchEvent(new Event('change', {
            bubbles: true
        }));
        input.dispatchEvent(new Event('keyup', {
            bubbles: true
        }));
        input.dispatchEvent(new Event('keydown', {
            bubbles: true
        }));
        input.dispatchEvent(new Event('keypress', {
            bubbles: true
        }));
        input.dispatchEvent(new Event('input', {
            bubbles: true
        }));
        input.dispatchEvent(new Event('blur', {
            bubbles: true
        }));
    }

    function isPresent(selector) {
        const el = document.querySelector(selector);
        return !!(el && isVisible(el));
    }

    function isVisible(e) {
        return !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length);
    };

    function waitForElement(selectors, interval = 250, seconds = 0, waitForDisappear = false) {
        return new Promise((resolve) => {
            if (!Array.isArray(selectors)) {
                selectors = [selectors];
            }

            seconds = seconds * 1000;

            const startTime = Date.now();
            const check = () => {
                let found = selectors.some(s => {
                    const el = document.querySelector(s);
                    return !!(el && isVisible(el));
                })

                if (!waitForDisappear && found || waitForDisappear && !found) {
                    return resolve(true);
                }

                if (seconds > 0 && Date.now() - startTime > seconds) {
                    return resolve(false);
                }

                setTimeout(check, interval);
            };

            check();
        });
    };

    function log(dataStr) {
        console.log(dataStr);
    }

    function parseString(str) {
        if (str == "") return null;
        if (/\w+@[\w\.-]+\.\w+[:\t]\w+/.test(str)) {
            return str.split(/[:\t]/);
        } else return null;
    }

    function sendMouseEvent(x, y, element, eventType) {
        let evObj = document.createEvent('MouseEvents');
        evObj.initMouseEvent(eventType, true, true, window, 1, x, y, x, y, false, false, false, false, 0, null);
        element.dispatchEvent(evObj);
    }

    function getCode() {
        let code = document.querySelector('#nc_1__imgCaptcha_img img').src.slice(861, 871);
        switch (code) {
            case 'OPv8A4peDN':
                return 'efu2';
            case 'MHxp4hfwr4':
                return 'mrrp';
            case 'KFlrWmald3':
                return 'usn8';
            case 'ILq9tbGMSX':
                return 'dbpr';
            case 'EZ1QZZgo9S':
                return '7fkt';
            case 'CgBk0qQQST':
                return 'rcvc';
            case 'Ed1jRndgqq':
                return '5ufh';
            case 'CgDK8S6udA':
                return 'uh9g';
            case 'QaTpd1qF0x':
                return '9gnn';
            case 'FvtTkQulpb':
                return 'bwsj';
            default:
                return '----';
        }
    }

})();
