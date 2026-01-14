import { Menu } from "lucide-react";

interface ContentNavbarProps {
    showBurger: boolean;
    onBurgerClick: () => void;
}

export default function ContentNavbar({ showBurger, onBurgerClick }: ContentNavbarProps) {
    return (
        <div className="sticky top-0 bg-gray-100 p-4 flex items-center z-10">
            {showBurger && (
                <button
                    className="text-gray-600 mr-4"
                    onClick={onBurgerClick}
                    aria-label="Toggle menu"
                >
                    <Menu size={24} />
                </button>
            )}
            <h1 className="text-xl font-semibold">페이지 제목</h1>
        </div>
    );
}