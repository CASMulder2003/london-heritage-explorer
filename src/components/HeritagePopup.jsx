export default function HeritagePopup({ site, showPopup, onClose }) {
    if (!showPopup || !site) return null;
  
    return (
      <div className="heritage-popup">
        <button className="popup-close" onClick={onClose}>
          ×
        </button>
        <div className="popup-num">{site.id}</div>
        <div className="popup-img">Image placeholder</div>
        <div className="popup-name">{site.name}</div>
        <div className="popup-desc">{site.description}</div>
      </div>
    );
  }