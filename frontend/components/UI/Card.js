const Card = ({ children, className = '' }) => {
  return (
    <div
      className={'bg-white/70 backdrop-blur-xl p-6 rounded-3xl ' + 
                 'shadow-lg border border-white/80 ' +
                 'transition-all duration-300 ' +
                 className}
    >
      {children}
    </div>
  );
};

export default Card;
