import React from 'react';
import PropTypes from 'prop-types';
import Constants from 'uxcore-const';
import classnames from 'classnames';
import assign from 'object-assign';
import deepequal from 'lodash/isEqual';
import Promise from 'lie';

/* eslint-disable class-methods-use-this */
class FormField extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      value: props.value,
      formatValue: this.formatValue(props.value),
      error: false,
      errMsg: '',
    };
  }

  componentDidMount() {
    const me = this;
    if (!me.props.standalone) {
      me.props.attachFormField(me);
      me.props.handleDataChange(me, {
        value: me.props.value,
        pass: true,
      }, true);
    }
  }

  componentWillReceiveProps(nextProps) {
    const me = this;
    if (!deepequal(nextProps.value, me.props.value)) {
      me.handleDataChange(nextProps.value, true, true, true);
    }
  }

  componentWillUnmount() {
    const me = this;
    if (!me.props.standalone) {
      this.props.detachFormField(this);
    }
  }

  getSize() {
    const me = this;
    return me.props.size || me.props.jsxsize;
  }

  getProps() {
    return this.props;
  }

  getLabelNode() {
    return this.label;
  }

  getTipsNode() {
    return this.tips;
  }

  getRequiredNode() {
    return this.required;
  }

  getErrorNode() {
    return this.errorNode;
  }

  getFieldCore() {
    return this.fieldCore;
  }

  getName() {
    return this.props.jsxname;
  }

  getValue() {
    return this.formatValue(this.state.value);
  }

  setValue(value, fromReset, fromPropsChange, next) {
    const me = this;
    const newState = {
      value,
      formatValue: me.formatValue(value),
      /*
       * why set state fromReset? some field like editor cannot be reset in the common way
       * so set this state to tell the field that you need to reset by yourself.
       */
      fromReset: !!fromReset,
    };
    if (fromReset && fromPropsChange === undefined) {
      newState.error = false;
    }
    me.setState(newState, () => {
      if (next && typeof next === 'function') {
        next();
      }
    });
  }

  saveRef(refName) {
    const me = this;
    return (c) => {
      me[refName] = c;
    };
  }

  /**
   * selectFormField depends on this method
   */
  // _isEqual(a, b) {
  //   return deepequal(a, b);
  // }

  /*
   * Fired when field value changes，update form's state and then trigger re-render.
   * @param fromReset {boolean} if handleDataChange is invoked by form's resetValues,
   */

  handleDataChange(value, fromReset, silence, fromPropsChange) {
    const me = this;
    const { asyncValidate } = me.props;
    me.setValue(value, fromReset, fromPropsChange, () => {
      let pass = true;
      // validateOnBlur only support InputFormField & TextAraeFormField now
      if (!fromReset && !me.props.standalone && !me.props.validateOnBlur) {
        const validatePass = me.doValidate();
        if (!asyncValidate) {
          pass = validatePass;
        }
      }
      if (me.props.handleDataChange) {
        me.props.handleDataChange(me, {
          value,
          pass,
        }, silence);
      }
    });
  }


  /**
   * @return {boolean} if validate pass, return true, or, return false
   * if no rule, it means validate pass.
   */

  doValidate(force, always) {
    const me = this;
    const async = me.props.asyncValidate || false;
    let instant = true;
    if ('instantValidate' in me.props) {
      instant = me.props.instantValidate;
    } else {
      instant = me.props.jsxinstant;
    }
    // `force` has the top priority, `undefined` is not equal to `false`
    // `instant` has the sceond priority here
    // eternalsky@2016.03.15
    if (force === true || (force !== false && instant)) {
      if (me.props.jsxrules) {
        if (!async) {
          const error = me.isDirty(always);
          me.setState({
            error: error.isDirty,
            errMsg: error.errMsg,
          });
          return !error.isDirty;
        }
        return new Promise((resolve) => {
          me.isDirty(always, async).then((errMsg) => {
            if (typeof errMsg === 'string') {
              me.setState({
                error: true,
                errMsg,
              });
              resolve(false);
            }
          }).catch((err) => {
            if (typeof err === 'object' && err.stack) {
              console.error(err.stack);
            } else {
              me.setState({
                error: false,
              });
              resolve(true);
            }
          });
        });
      }
      return true;
    }
    return true;
  }

  /*
   * rule can be an object, containing errMsg & validator,
   * and rule can also be an array containing such objects.
   * this func will check them one by one, and return false
   * unless all rules pass
   */

  isDirty(always, async = false) {
    const me = this;
    const rules = me.props.jsxrules;
    let isDirty = false;
    let errMsg = '';
    if (!async) {
      if (typeof rules === 'object' && !Array.isArray(rules)) {
        isDirty = (always === undefined) ? !rules.validator(me.state.value) : !always;
        errMsg = rules.errMsg;
      } else if (Array.isArray(rules)) {
        for (let i = 0; i < rules.length; i++) {
          isDirty = (always === undefined) ? !rules[i].validator(me.state.value) : !always;
          if (isDirty) {
            errMsg = rules[i].errMsg;
            break;
          }
        }
      }
      return {
        isDirty,
        errMsg,
      };
    }
    if (typeof rules !== 'function') {
      console.error('Form Validate: In async validation mode,'
        + ' jsxrules(rules) should be a function');
      return {
        isDirty: false,
      };
    }
    return new Promise((resolve, reject) => {
      rules(me.state.value, reject, resolve);
    });
  }


  addSpecificClass() {
    return '';
  }

  /*
   * You should rewrite this method，when you need to format the value as you concern.
   */

  formatValue(value) {
    return value;
  }

  getDataProps() {
    const dataProps = {};
    Object.keys(this.props).forEach((propName) => {
      if (/^data\-/.test(propName)) {
        dataProps[propName] = this.props[propName];
      }
    });
    return dataProps;
  }

  getDom() {
    return this.fieldRoot;
  }

  renderTips() {
    const me = this;
    const mode = me.props.jsxmode || me.props.mode;
    if (mode !== Constants.MODE.EDIT) return null;
    if (me.props.standalone && me.props.message && me.props.message.type === 'tip') {
      return (
        <li className="kuma-uxform-tips">
          <i className="kuma-icon kuma-icon-information" />
          <span ref={me.saveRef('tips')} className="kuma-uxform-message-content">{me.props.message.message}</span>
        </li>
      );
    }
    if (!!this.props.jsxtips && !me.state.error) {
      return (
        <li className="kuma-uxform-tips">
          <i className="kuma-icon kuma-icon-information" />
          <span className="kuma-uxform-message-content" ref={me.saveRef('tips')}>{this.props.jsxtips}</span>
        </li>
      );
    }
    return null;
  }

  /*
   * You should rewrite this method, when you are developing a new type of form field.
   */

  renderField() {}

  renderErrorMsg() {
    const me = this;
    const mode = me.props.jsxmode || me.props.mode;
    if (mode !== Constants.MODE.EDIT) return null;
    if (me.props.standalone && me.props.message && me.props.message.type === 'error') {
      return (
        <li className="kuma-uxform-errormsg">
          <i className="kuma-icon kuma-icon-error" />
          <span ref={me.saveRef('errorNode')} className="kuma-uxform-message-content">{me.props.message.message}</span>
        </li>
      );
    }
    if (me.state.error) {
      return (
        <li className="kuma-uxform-errormsg">
          <i className="kuma-icon kuma-icon-error" />
          <span ref={me.saveRef('errorNode')} className="kuma-uxform-message-content">{me.state.errMsg}</span>
        </li>
      );
    }
    return null;
  }

  renderLabel() {
    const me = this;
    const mode = me.props.jsxmode || me.props.mode;
    // jsxVerticalAlign is an internal varible.
    let align = me.props.verticalAlign;
    if (align === undefined) {
      align = me.props.jsxVerticalAlign;
    }
    if (me.props.jsxshowLabel) {
      return (
        <label
          key="label"
          className={classnames({
            'kuma-label': true,
            'vertical-align': align,
            'label-match-input-height': (me.props.labelMatchInputHeight && mode === Constants.MODE.EDIT),
          })}
        >
          <span className="required" ref={me.saveRef('required')}>
            {(me.props.required && mode === Constants.MODE.EDIT) ? '* ' : ''}
          </span>
          <span
            className="label-content"
            ref={me.saveRef('label')}
            dangerouslySetInnerHTML={{
              __html: me.props.jsxlabel,
            }}
          />
        </label>
      );
    }
    return null;
  }

  renderContent() {
    const me = this;
    const mode = me.props.jsxmode || me.props.mode;
    const align = me.props.verticalAlign || me.props.jsxVerticalAlign;
    const { jsxshowLabel } = me.props;
    if (me.props.labelMatchInputHeight && mode === Constants.MODE.EDIT) {
      const tips = me.renderTips();
      const errorMsg = me.renderErrorMsg();
      return [
        <div
          key="content"
          style={{
            display: 'table',
          }}
        >
          {me.renderLabel()}
          <ul
            className={classnames({
              'kuma-uxform-field-content': true,
              'view-mode': mode === Constants.MODE.VIEW,
              'edit-mode': mode === Constants.MODE.EDIT,
              'has-error': !!me.state.error,
            })}
          >
            <li
              ref={me.saveRef('fieldCore')}
              className="kuma-uxform-field-core"
            >{me.renderField()}</li>
          </ul>
        </div>,
        (tips || errorMsg) ? <div
          key="tip"
          className="kuma-uxform-tip-box"
          style={{
            display: 'table',
          }}
        >
          {(!align && jsxshowLabel) ? <label
            className={classnames({
              'kuma-label': true,
            })}
          /> : null}
          <ul>
            {me.renderTips()}
            {me.renderErrorMsg()}
          </ul>
        </div> : null,
      ];
    }
    return [
      me.renderLabel(),
      <ul
        key="content"
        className={classnames({
          'kuma-uxform-field-content': true,
          'view-mode': mode === Constants.MODE.VIEW,
          'edit-mode': mode === Constants.MODE.EDIT,
          'has-error': !!me.state.error,
        })}
      >
        <li
          key="core"
          ref={me.saveRef('fieldCore')}
          className="kuma-uxform-field-core"
        >{me.renderField()}</li>
        {me.renderTips()}
        {me.renderErrorMsg()}
      </ul>,
    ];
  }

  render() {
    const me = this;
    const specificCls = me.addSpecificClass();
    const mode = me.props.jsxmode || me.props.mode;
    const dataProps = this.getDataProps();
    const style = {};
    if (!me.props.standalone) {
      style.width = `${(me.props.jsxflex / me.props.totalFlex) * 100}%`;
    }
    const size = this.getSize();
    return (
      <div
        className={classnames({
          [me.props.jsxprefixCls]: true,
          [specificCls]: !!specificCls,
          [`${me.props.jsxprefixCls}-${size}`]: !!size,
          [me.props.className]: !!me.props.className,
          [`${me.props.jsxprefixCls}__view`]: mode === Constants.MODE.VIEW,
        })}
        style={assign({}, style, {
          display: me.props.jsxshow ? 'table' : 'none',
        })}
        ref={(c) => { this.fieldRoot = c; }}
        {...dataProps}
      >
        {me.renderContent()}
      </div>
    );
  }
}

FormField.propTypes = {
  instantValidate: PropTypes.bool,
  verticalAlign: PropTypes.bool,
  labelMatchInputHeight: PropTypes.bool,
  value: PropTypes.any,
  jsxshow: PropTypes.bool,
  mode: PropTypes.string,
  jsxmode: PropTypes.string,
  jsxshowLabel: PropTypes.bool,
  jsxprefixCls: PropTypes.string,
  jsxflex: PropTypes.number,
  jsxname: PropTypes.string.isRequired,
  jsxplaceholder: PropTypes.string,
  jsxlabel: PropTypes.string,
  jsxtips: PropTypes.string,
  jsxrules: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.array,
    PropTypes.func,
  ]),
  totalFlex: PropTypes.number,
  standalone: PropTypes.bool,
  required: PropTypes.bool,
  attachFormField: PropTypes.func,
  detachFormField: PropTypes.func,
  getValues: PropTypes.func,
  resetValues: PropTypes.func,
  handleDataChange: PropTypes.func,
  style: PropTypes.object,
};

FormField.defaultProps = {
  labelMatchInputHeight: false,
  jsxshow: true,
  jsxshowLabel: true,
  jsxprefixCls: 'kuma-uxform-field',
  formPrefixCls: 'kuma-uxform',
  jsxflex: 1,
  jsxname: '',
  jsxplaceholder: '',
  jsxlabel: '',
  jsxtips: '',
  standalone: false,
  mode: Constants.MODE.EDIT,
  required: false,
};

FormField.displayName = 'FormField';

export default FormField;
