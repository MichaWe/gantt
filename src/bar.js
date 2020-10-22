import date_utils from './date_utils';
import { $, createSVG, animateSVG } from './svg_utils';

export default class Bar {
    constructor(gantt, task, period) {
        if (!period) {
            period = task;
        }
        this.set_defaults(gantt, task, period);
        this.prepare();
        this.draw();
        this.bind();
    }

    set_defaults(gantt, task, period) {
        this.action_completed = false;
        this.gantt = gantt;
        this.task = task;
        this.period = period;
    }

    prepare() {
        this.prepare_values();
        this.prepare_helpers();
    }

    prepare_values() {
        this.text_align = this.gantt.options.bar_text_align;
        if (this.task.text_align) {
            this.text_align = this.task.text_align;
        }

        this.invalid = this.task.invalid && !this.task.header === true;
        this.height = this.gantt.options.bar_height;
        this.x = this.compute_x();
        this.y = this.compute_y();
        this.corner_radius = this.gantt.options.bar_corner_radius;
        if (this.task.header === true) {
            this.duration =
                date_utils.diff(
                    this.gantt.gantt_end,
                    this.gantt.gantt_start,
                    'hour'
                ) / this.gantt.options.step;
        } else {
            this.duration =
                date_utils.diff(
                    Math.min(this.period._end, this.gantt.gantt_end),
                    Math.max(this.period._start, this.gantt.gantt_start),
                    'hour'
                ) / this.gantt.options.step;
        }
        this.width = Math.max(
            this.gantt.options.column_width * this.duration,
            0
        );

        this.progress_width =
            this.gantt.options.column_width *
                this.duration *
                (this.task.progress / 100) || 0;

        const group_classes = ['bar-wrapper'];
        if (this.period && this.period.custom_class) {
            group_classes.push(this.period.custom_class);
        }
        if (this.task.custom_class) {
            group_classes.push(this.task.custom_class);
        }

        this.group = createSVG('g', {
            class: group_classes.join(' '),
            'data-id': this.task.id
        });
        this.bar_group = createSVG('g', {
            class: 'bar-group',
            append_to: this.group
        });

        if (this.is_draggable()) {
            this.handle_group = createSVG('g', {
                class: 'handle-group',
                append_to: this.group
            });
        }
    }

    prepare_helpers() {
        SVGElement.prototype.getX = function() {
            return +this.getAttribute('x');
        };
        SVGElement.prototype.getY = function() {
            return +this.getAttribute('y');
        };
        SVGElement.prototype.getWidth = function() {
            return +this.getAttribute('width');
        };
        SVGElement.prototype.getHeight = function() {
            return +this.getAttribute('height');
        };
        SVGElement.prototype.getEndX = function() {
            return this.getX() + this.getWidth();
        };
    }

    draw() {
        // Do not draw hidden bars
        if (this.width <= 0) {
            return;
        }

        this.draw_bar();
        this.draw_progress_bar();
        this.draw_label();
        this.draw_resize_handles();
    }

    draw_bar() {
        let css_class = 'bar';
        if (this.period && this.period.css_class) {
            css_class += ' ' + this.period.css_class;
        } else if (this.task.css_class) {
            css_class += ' ' + this.task.css_class;
        }

        const attrs = {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: css_class,
            append_to: this.bar_group
        };

        if (this.period && this.period.fill) {
            attrs['style'] = 'fill: ' + this.period.fill;
        } else if (this.task.fill) {
            attrs['style'] = 'fill: ' + this.task.fill;
        }

        this.$bar = createSVG('rect', attrs);

        //animateSVG(this.$bar, 'width', 0, this.width);

        if (this.invalid) {
            this.$bar.classList.add('bar-invalid');
        }
    }

    draw_progress_bar() {
        if (this.invalid) return;
        this.$bar_progress = createSVG('rect', {
            x: this.x,
            y: this.y,
            width: this.progress_width,
            height: this.height,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'bar-progress',
            append_to: this.bar_group
        });

        //animateSVG(this.$bar_progress, 'width', 0, this.progress_width);
    }

    get_label_x(scroll_offset) {
        const bar = this.$bar;
        let x = bar.getX() + bar.getWidth() / 2;
        if (this.text_align === 'left') {
            x = bar.getX() + this.gantt.options.padding;
        } else if (this.text_align === 'right') {
            x = bar.getX() + bar.getWidth() - this.gantt.options.padding;
        }

        if (scroll_offset) {
            x += scroll_offset;
        }

        return x;
    }

    draw_label() {
        createSVG('text', {
            x: this.get_label_x(),
            y: this.y + this.height / 2,
            innerHTML: this.period.name || this.task.name,
            class: 'bar-label bar-label-' + this.text_align,
            append_to: this.bar_group
        });
        // labels get BBox in the next tick
        requestAnimationFrame(() => this.update_label_position());
    }

    draw_resize_handles() {
        if (this.is_draggable() === false) return;

        const bar = this.$bar;
        const handle_width = 8;

        createSVG('rect', {
            x: bar.getX() + bar.getWidth() - 9,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle right',
            append_to: this.handle_group
        });

        createSVG('rect', {
            x: bar.getX() + 1,
            y: bar.getY() + 1,
            width: handle_width,
            height: this.height - 2,
            rx: this.corner_radius,
            ry: this.corner_radius,
            class: 'handle left',
            append_to: this.handle_group
        });

        if (this.task.progress && this.task.progress < 100) {
            this.$handle_progress = createSVG('polygon', {
                points: this.get_progress_polygon_points().join(','),
                class: 'handle progress',
                append_to: this.handle_group
            });
        }
    }

    get_progress_polygon_points() {
        const bar_progress = this.$bar_progress;
        return [
            bar_progress.getEndX() - 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX() + 5,
            bar_progress.getY() + bar_progress.getHeight(),
            bar_progress.getEndX(),
            bar_progress.getY() + bar_progress.getHeight() - 8.66
        ];
    }

    bind() {
        if (this.invalid) return;
        this.setup_click_event();
    }

    setup_click_event() {
        $.on(this.group, 'focus ' + this.gantt.options.popup_trigger, e => {
            if (this.action_completed) {
                // just finished a move action, wait for a few seconds
                return;
            }

            if (e.type === 'click') {
                this.gantt.trigger_event('click', [this.task, this.period]);
            }

            this.gantt.unselect_all();
            this.group.classList.toggle('active');

            this.show_popup();
        });
    }

    show_popup() {
        if (this.gantt.bar_being_dragged) return;

        const start_date = date_utils.format(
            this.period._start,
            'MMM D',
            this.gantt.options.language
        );
        const end_date = date_utils.format(
            date_utils.add(this.period._end, -1, 'second'),
            'MMM D',
            this.gantt.options.language
        );
        const subtitle = start_date + ' - ' + end_date;

        this.gantt.show_popup({
            target_element: this.$bar,
            title: this.task.name,
            subtitle: subtitle,
            task: this.task
        });
    }

    update_bar_position({ x = null, width = null }) {
        if (this.invalid || this.period.disabled === true) return;

        const bar = this.$bar;
        if (x) {
            // get all x values of parent task
            const xs = this.task.dependencies.map(dep => {
                return this.gantt.get_bar(dep).$bar.getX();
            });
            // child task must not go before parent
            const valid_x = xs.reduce((prev, curr) => {
                return x >= curr;
            }, x);
            if (!valid_x) {
                width = null;
                return;
            }
            this.update_attr(bar, 'x', x);
        }
        if (width && width >= this.gantt.options.column_width) {
            this.update_attr(bar, 'width', width);
        }
        this.update_label_position();
        this.update_handle_position();
        this.update_progressbar_position();
        this.update_arrow_position();
    }

    update_header_position(scrolling_container) {
        if (this.task.header === true) {
            const scroll_x = scrolling_container.scrollLeft;
            const label = this.group.querySelector('.bar-label');

            label.setAttribute('x', this.get_label_x(scroll_x));
        }
    }

    date_changed() {
        let changed = false;
        const { new_start_date, new_end_date } = this.compute_start_end_date();

        if (Number(this.period._start) !== Number(new_start_date)) {
            changed = true;
            this.period._start = new_start_date;
        }

        if (Number(this.period._end) !== Number(new_end_date)) {
            changed = true;
            this.period._end = new_end_date;
        }

        if (!changed) return;

        this.gantt.trigger_event('date_change', [
            this.task,
            new_start_date,
            date_utils.add(new_end_date, -1, 'second')
        ]);
    }

    progress_changed() {
        const new_progress = this.compute_progress();
        this.task.progress = new_progress;
        this.gantt.trigger_event('progress_change', [this.task, new_progress]);
    }

    set_action_completed() {
        this.action_completed = true;
        setTimeout(() => (this.action_completed = false), 1000);
    }

    compute_start_end_date() {
        const bar = this.$bar;
        const x_in_units = bar.getX() / this.gantt.options.column_width;
        const new_start_date = date_utils.add(
            this.gantt.gantt_start,
            x_in_units * this.gantt.options.step,
            'hour'
        );
        const width_in_units = bar.getWidth() / this.gantt.options.column_width;
        const new_end_date = date_utils.add(
            new_start_date,
            width_in_units * this.gantt.options.step,
            'hour'
        );

        return { new_start_date, new_end_date };
    }

    compute_progress() {
        const progress =
            this.$bar_progress.getWidth() / this.$bar.getWidth() * 100;
        return parseInt(progress, 10);
    }

    compute_x() {
        const { step, column_width } = this.gantt.options;
        const task_start = this.period._start;
        const gantt_start = this.gantt.gantt_start;

        if (this.task.header === true) {
            return 0;
        }

        const diff = Math.max(
            0,
            date_utils.diff(task_start, gantt_start, 'hour')
        );
        let x = diff / step * column_width;

        if (this.gantt.view_is('Month')) {
            const diff = Math.max(
                0,
                date_utils.diff(task_start, gantt_start, 'day')
            );
            x = diff * column_width / 30;
        }
        return x;
    }

    compute_y() {
        return (
            this.gantt.options.header_height +
            this.gantt.options.padding +
            this.task._index * (this.height + this.gantt.options.padding)
        );
    }

    get_snap_position(dx) {
        let odx = dx,
            rem,
            position;

        if (this.gantt.view_is('Week')) {
            rem = dx % (this.gantt.options.column_width / 7);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 14
                    ? 0
                    : this.gantt.options.column_width / 7);
        } else if (this.gantt.view_is('Month')) {
            rem = dx % (this.gantt.options.column_width / 30);
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 60
                    ? 0
                    : this.gantt.options.column_width / 30);
        } else {
            rem = dx % this.gantt.options.column_width;
            position =
                odx -
                rem +
                (rem < this.gantt.options.column_width / 2
                    ? 0
                    : this.gantt.options.column_width);
        }
        return position;
    }

    update_attr(element, attr, value) {
        value = +value;
        if (!isNaN(value)) {
            element.setAttribute(attr, value);
        }
        return element;
    }

    update_progressbar_position() {
        const taskProgress = this.task.progress ? this.task.progress : 0;
        this.$bar_progress.setAttribute('x', this.$bar.getX());
        this.$bar_progress.setAttribute(
            'width',
            this.$bar.getWidth() * (taskProgress / 100)
        );
    }

    update_label_position() {
        if (this.task.header === true) {
            return;
        }

        const bar = this.$bar,
            label = this.group.querySelector('.bar-label');

        if (label.getBBox().width > bar.getWidth()) {
            label.classList.add('big');
            label.setAttribute('x', bar.getX() + bar.getWidth() + 5);
        } else {
            label.classList.remove('big');
            label.setAttribute('x', this.get_label_x());
        }
    }

    update_handle_position() {
        const bar = this.$bar;
        this.handle_group
            .querySelector('.handle.left')
            .setAttribute('x', bar.getX() + 1);
        this.handle_group
            .querySelector('.handle.right')
            .setAttribute('x', bar.getEndX() - 9);
        const handle = this.group.querySelector('.handle.progress');
        handle &&
            handle.setAttribute('points', this.get_progress_polygon_points());
    }

    update_arrow_position() {
        this.arrows = this.arrows || [];
        for (let arrow of this.arrows) {
            arrow.update();
        }
    }

    is_draggable() {
        return (
            this.period.disabled !== true &&
            this.invalid !== true &&
            this.period.draggable !== false &&
            this.task.header !== true &&
            this.task === this.period &&
            !this.task.periods
        );
    }
}

function isFunction(functionToCheck) {
    var getType = {};
    return (
        functionToCheck &&
        getType.toString.call(functionToCheck) === '[object Function]'
    );
}
