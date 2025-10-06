import { useState } from 'react';

const Input = ({ label, type = 'text', value, onChange, placeholder = '', icon, required = false, className = '' }) => {
  const [isFocused, setIsFocused] = useState(false);

  const inputId = 'input-' + label.replace(/\s/g, '-').toLowerCase();

  return (
    <div className={'space-y-1 ' + className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          required={required}
          placeholder={placeholder}
          className={
            'block w-full ' +
            (icon ? 'pl-10 ' : 'pl-4 ') +
            'pr-4 py-3 border border-gray-300 rounded-xl shadow-inner-sm ' +
            'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ' +
            'bg-white/95 transition duration-150 ease-in-out text-gray-800'
          }
        />
      </div>
    </div>
  );
};

export default Input;
