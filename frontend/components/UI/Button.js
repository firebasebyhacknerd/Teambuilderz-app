const Button = ({ children, onClick, type = 'submit', disabled = false }) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={'w-full py-3 rounded-xl shadow-lg ' + 
                 'text-base font-medium text-white ' +
                 'transition duration-150 ease-in-out ' +
                 'bg-blue-600 hover:bg-blue-700 ' +
                 'focus:outline-none focus:ring-4 focus:ring-blue-300 ' +
                 'disabled:opacity-50 disabled:cursor-not-allowed ' +
                 (disabled ? 'cursor-not-allowed' : '')}
    >
      {children}
    </button>
  );
};

export default Button;
