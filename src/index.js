import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import registerServiceWorker from './registerServiceWorker';
import './App.css';

class List{
  constructor() {
    this.firstObj=null;
    this.lastObj=null;
    this.length=0;
  }
  add(obj){
    obj.nextObj=null;
    obj.prevObj=null;
    if(this.firstObj){
      this.lastObj.nextObj=obj;
      obj.prevObj=this.lastObj;
      this.lastObj=obj;  
    }else{
      this.firstObj=obj;
      this.lastObj=obj;
    }
    this.length++; 
  }
  deleteItem(dot){
    if((dot==this.firstObj)&&(dot==this.lastObj)){
      this.firstObj=null;  
      this.lastObj=null;
    }
    else if(dot==this.firstObj){
      this.firstObj=dot.nextObj;
      dot.prevObj=null;
    }
    else if(dot==this.lastObj){
      this.lastObj=dot.prevObj;
      dot.prevObj.nextObj=null;
    }else{
      dot.prevObj.nextObj=dot.nextObj;
      dot.nextObj.prevObj=dot.prevObj;
    }
    dot.nextObj=null;
    dot.prevObj=null;
    this.length--; 
  }
  print(){
    let currDot=this.firstObj;
    while(currDot){
      console.log(currDot.id);
      currDot=currDot.nextObj;
    }
  }
  insert(dot){
    dot.nextObj=null; 
    dot.prevObj=null;
    let pos=0;
    let currDot=this.firstObj;
    let bool=true;
    while(currDot&&bool){
      if(currDot.id!=dot.newPosId)
      {
        pos++;
        currDot=currDot.nextObj;
      }else{
        bool=false;
      }
    } 
    if(pos==(this.length-1))
      this.add(dot);
    else{
      dot.prevObj=currDot;
      currDot.nextObj.prevObj=dot;
      dot.nextObj=currDot.nextObj; 
      currDot.nextObj=dot;
      this.length++;
    }
  }
}

//action - что нужно сделать с точкой: добавить/удалить/переместить в списке/изменить координаты
//newPosId - не обязательный параметр - при перемещении точки в списке, разместить ее после точкой с этим Id
class Dot{
  constructor(name,position,id,action,newPosId) {
    this.name=name;
    this.position=position;
    this.id=id;
    this.action=action;
    this.newPosId=newPosId;
  }
}

class EnterInput extends React.Component {
  constructor(props) { 
    super(props);
    this.handleKeyPress = this.handleKeyPress.bind(this);
  }
  handleKeyPress(e) {
    if (e.key === 'Enter') {
      this.props.onEnter(e.target.value);
    }
  }

  render() {
    return <input type="text" onKeyPress={this.handleKeyPress} className="enterInput" />
  }
}

class PlaceMark extends React.Component {
  constructor(props) { 
    super(props);
    this.dot=props.dot;
    this.placemark=null;
    this.dragEndHandler = this.dragEndHandler.bind(this);
  }
  dragEndHandler(e){
   var thisPlacemark = e.get('target');
   // Определение координат метки
   this.dot.position = thisPlacemark.geometry.getCoordinates();
   this.props.dotCoordsChangeCallBack();
  }
  componentDidMount() { 
    this.placemark = new this.props.ymaps.Placemark(this.dot.position,
      { balloonContentBody:this.dot.name},
      { 
        draggable: true,
        balloonPanelMaxMapArea: 0
      }
    );
    this.placemark.events.add('dragend', this.dragEndHandler);
    this.props.map.geoObjects.add(this.placemark);
  }
  componentWillUnmount(){
    this.props.map.geoObjects.remove(this.placemark);
  }
  render() {
    return false;
  }
}

class Map extends React.Component {
  constructor(props) { 
    super(props);
    this.state = {
      gotMap:false
    };
    this.map=null;
    this.ymaps=null;
    Map.currObj=this;
    this.route=null;
  }
  componentDidMount(){
    let script = document.createElement("script");
    script.setAttribute("type","text/javascript");

    script.setAttribute("src", "https://api-maps.yandex.ru/2.1-dev/?lang=ru_RU&onload=Map.apiReady");
    document.getElementsByTagName("head")[0].appendChild(script);
  }
  onApiLoaded(ymaps){ 
    this.ymaps=ymaps;
    let mapDiv=this.props.mapDiv.current;
    this.map = new this.ymaps.Map(mapDiv, {//создаем карту
      center: [55.76, 37.64],
      zoom: 11
    });
    this.setState({gotMap:true});
  }
  render() {
    if (!Map.isApiReady) {
      return <div>API пока не готов к работе</div>
    }else{ 
      if(this.route)
        this.map.geoObjects.remove(this.route);
      let routeArr=[];
      let placeMarkArr=[];
      let dotsList=this.props.dotsList;
      let currDot=dotsList.firstObj;
      while(currDot){ 
        if(!currDot.position)
          currDot.position=this.map.getCenter();
        routeArr.push(currDot.position);
        let placeMark=<PlaceMark map={this.map} ymaps={this.ymaps} dot={currDot} key={currDot.id} dotCoordsChangeCallBack={this.props.dotCoordsChangeCallBack}/>
        placeMarkArr.push(placeMark);
        currDot=currDot.nextObj;
      }
      this.route=new this.ymaps.Polyline(routeArr);
      this.map.geoObjects.add(this.route);
      return placeMarkArr;
    }
  }
}
Map.isApiReady=false;
Map.currObj=null;
window.Map.apiReady=function (ymaps){
  Map.isApiReady=true;
  Map.currObj.onApiLoaded(ymaps);
};

class DotsListItem extends React.Component {
  constructor(props) {
    super(props);
    this.dot=this.props.dot;
    this.edgeObjRect=null; //координаты контейнера, внутри которого двигаемся
    this.moveObjRect=null; //координаты объекта, который двигаем
    this.moveObj=null;//ссылка на DOM-элемент, который двигаем
    this.oldMousePos={x:null};
    this.deleteClick = this.deleteClick.bind(this);
    this.mouseMove = this.mouseMove.bind(this);
    this.mouseUp = this.mouseUp.bind(this);
    this.mouseDown = this.mouseDown.bind(this);
    //вообще было бы умнее вынести эти события из объекта в статические методы, чтобы не создавать эти
    //события при каждом создании объекта, но, как говорится, "преждевременная оптимизация - это корень всех зол" :)
    window.document.addEventListener('mousemove', this.mouseMove); //цепляем событие mousemove на весь документ
    window.document.addEventListener('mouseup', this.mouseUp);//цепляем событие mouseup на весь документ
  }
  deleteClick(){
    this.props.deleteCallBack(this.dot);
  }
  mouseMove(e){
    if(!this.moveObj)
      return;
    var moveObjRect=this.moveObjRect;
    var deltaY=e.pageY-this.oldMousePos.y;//сдвиг мышки по Y
    
    if(deltaY<0)//если движемся вверх
    {
      if((moveObjRect.top+deltaY)<=(this.edgeObjRect.top))//проверяем верхний край: не заходит ли он дальше границы. Если заходит...
      {
        deltaY=(this.edgeObjRect.top)-moveObjRect.top;//делаем сдвиг таким, чтобы moveObj дошел только до верхней границы, не дальше
      }
    }else if(deltaY>0)//если движемся вниз
    {
      if((moveObjRect.bottom+deltaY)>=(this.edgeObjRect.bottom))//проверяем нижний край: не заходит ли он дальше границы. Если заходит...
      {
        deltaY=(this.edgeObjRect.bottom)-moveObjRect.bottom;//делаем сдвиг таким, чтобы moveObj дошел только до нижней границы, не дальше
      }
    }
    this.moveObj.style.top=parseInt(this.moveObj.style.top)+deltaY+"px" ;//присваиваем moveObj новые координаты
    this.oldMousePos.y=e.pageY;//запоминаем позицию мышки
  }
  mouseUp(e){
    if(!this.moveObj)
      return;
    let y=this.moveObj.getBoundingClientRect().top;
    this.moveObj.style.top='0px';
    let elem = window.document.elementFromPoint(e.clientX, y); 
    let idx=elem.getAttribute('dotid'); 
    if(idx){
      idx=parseInt(idx);
      if(idx!=this.dot.id){
        this.dot.newPosId=idx; 
        this.props.listPosCallBack(this.dot);
      }
    }
    this.moveObj=null; 
  }
  mouseDown(e){
    if(e.target.className=='listItemDel')
      return;
    this.moveObj = e.currentTarget; 
    this.edgeObjRect=this.props.containerRef.current.getBoundingClientRect();//запоминаем размеры контейнера, внутри которого двигаемся
    this.oldMousePos.y=e.pageY;//запоминаем позицию мышки
    this.moveObjRect=this.moveObj.getBoundingClientRect();//получаем координаты объекта, который двигаем
    e.preventDefault();
  }
  render() {
    const style = {
     top:'0px' //сбрасываем смещение на случай, если элемент двигали мышкой
    };
    return(
      //dotid сажаем во все 3 элемента т.к. не знаем, какой из них вернет ф-ция elementFromPoint()
      <div className="listItemWrap" style={style} onMouseDown={this.mouseDown} dotid={this.dot.id}>
        <div className="listItemName" dotid={this.dot.id}>{this.dot.name}</div>
        <div className="listItemDel" onClick={this.deleteClick} dotid={this.dot.id}>X</div>
      </div>
    );
  }
}

class DotsList extends React.Component {
  constructor(props) {
    super(props);
    this.containerRef = React.createRef();
  }
   render() {
    let dotsArr=[];
    let dotsList=this.props.dotsList;
    let currDot=dotsList.firstObj;
    while(currDot){
      let dotsListItem=<DotsListItem dot={currDot} containerRef={this.containerRef} key={currDot.id} deleteCallBack={this.props.deleteCallBack} listPosCallBack={this.props.listPosCallBack}/>
      dotsArr.push(dotsListItem);
      currDot=currDot.nextObj;
    }
    return(
      <div className="dotsListWrap" ref={this.containerRef}>
        {dotsArr}
      </div>
    );
   }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.list=new List();
    this.idCnt=0;
    this.state = {
      newDot:null
    };
    this.handleEnter = this.handleEnter.bind(this);
    this.deleteDot = this.deleteDot.bind(this);
    this.handleDotCoordsChange=this.handleDotCoordsChange.bind(this);
    this.changeListPos = this.changeListPos.bind(this);
    this.mapDivRef = React.createRef();
  }
  handleEnter(value) {
    let dot=new Dot(value,null,this.idCnt,'add');
    this.setState({newDot: dot});
    this.idCnt++;
  }
  handleDotCoordsChange(dot) {
    this.setState({newDot: dot});
  }
  addDot(newDot){
    this.list.add(newDot); 
    newDot.action=null;
  }
  deleteDot(dot){ 
    dot.action=null;
    this.list.deleteItem(dot);
    this.setState({newDot: dot});
  }
  changeListPos(dot){ 
    dot.action=null;
    this.list.deleteItem(dot); 
    this.list.insert(dot, dot.newPosId); 
    this.setState({newDot: dot});
  }
  render() { 
    let newDot=this.state.newDot;
    if(newDot){
      if(newDot.action=='add')
        this.addDot(newDot);
    }
    return (
      <div className='mainWrap'>
        <div className="inputListWrap">
         <EnterInput  onEnter={this.handleEnter} />
         <DotsList dotsList={this.list} deleteCallBack={this.deleteDot} listPosCallBack={this.changeListPos}/>
        </div>
        <div className="mapDiv" ref={this.mapDivRef}>
           <Map dotsList={this.list} mapDiv={this.mapDivRef} dotCoordsChangeCallBack={this.handleDotCoordsChange}/>
        </div>
      </div>
    );
  }
}
ReactDOM.render(<App />, document.getElementById("root"));

registerServiceWorker();
