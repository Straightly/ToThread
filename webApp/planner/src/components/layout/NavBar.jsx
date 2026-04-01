export default function NavBar({ navStack, onNavigateBack, onNavigateTo }) {
  if (navStack.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500 overflow-x-auto">
      <button
        onClick={() => onNavigateTo(-1)}
        className="hover:text-blue-600 shrink-0 font-medium"
      >
        Root
      </button>
      {navStack.map((item, i) => (
        <span key={item.id} className="flex items-center gap-1">
          <span className="text-gray-300">/</span>
          {i < navStack.length - 1 ? (
            <button
              onClick={() => onNavigateTo(i)}
              className="hover:text-blue-600 truncate max-w-[150px]"
            >
              {item.title}
            </button>
          ) : (
            <span className="text-gray-900 font-medium truncate max-w-[150px]">
              {item.title}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
