{
   "_id": "_design/pageView",
   "_rev": "1-5207d9b532a69c99c84892efd2c11b0b",
   "language": "javascript",
   "views": {
       "all": {
           "map": "function(doc) { if (doc.type == 'pageView')  emit(null, doc) }"
       },
       "by_userId": {
           "map": "function(doc) { if (doc.type == 'pageView')  emit(doc.userId, doc) }"
       }
   }
}

{
   "_id": "_design/stats",
   "language": "javascript",
   "views": {
       "hitCountByUrl": {
           "map": "function(doc) { if (doc.type == 'pageView')  emit(doc.pageUrl, 1) }",
           "reduce": "function(key, values, rereduce) { return sum(values) }"
       }
   }
}
